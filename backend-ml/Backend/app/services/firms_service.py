"""FIRMS service: live retrieval + validation + normalization.
Credentials never leave the backend, and external data is strictly sanitized.
"""
from __future__ import annotations

import asyncio
import csv
import io
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("firms")

# Documented mapping for VIIRS categorical confidence (l/n/h).
VIIRS_CONFIDENCE_MAP = {"l": 30.0, "n": 60.0, "h": 90.0}
MODIS_CONFIDENCE_MAP = {"l": 30.0, "n": 60.0, "h": 90.0}


def normalize_confidence(value: Any) -> dict:
    """Return {raw, level, numeric}. Numeric is an ordinal proxy, never claimed as %."""
    raw = value
    if value is None or (isinstance(value, str) and not value.strip()):
        return {"confidence_raw": None, "confidence_level": "unknown", "confidence_numeric": None}
    if isinstance(value, (int, float)):
        v = float(value)
        if 0 <= v <= 100:
            level = "low" if v < 40 else ("nominal" if v < 75 else "high")
            return {"confidence_raw": raw, "confidence_level": level, "confidence_numeric": v}
        return {"confidence_raw": raw, "confidence_level": "unknown", "confidence_numeric": None}
    s = str(value).strip().lower()
    if s in VIIRS_CONFIDENCE_MAP:
        level = {"l": "low", "n": "nominal", "h": "high"}[s]
        return {"confidence_raw": raw, "confidence_level": level, "confidence_numeric": VIIRS_CONFIDENCE_MAP[s]}
    # numeric strings
    try:
        v = float(s)
        if 0 <= v <= 100:
            level = "low" if v < 40 else ("nominal" if v < 75 else "high")
            return {"confidence_raw": raw, "confidence_level": level, "confidence_numeric": v}
    except ValueError:
        pass
    return {"confidence_raw": raw, "confidence_level": "unknown", "confidence_numeric": None}


def _f(v: Any) -> float | None:
    try:
        return float(v) if v is not None and str(v).strip() != "" else None
    except (TypeError, ValueError):
        return None


def sanitize_and_validate_row(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Strictly sanitize and validate external CSV row.
    Rejects malformed, out-of-range, or corrupted records.
    Returns cleaned dict or None if invalid.
    """
    raw_lat = raw.get("latitude", raw.get("lat", raw.get("Latitude")))
    raw_lon = raw.get("longitude", raw.get("lon", raw.get("Longitude")))

    try:
        lat = float(raw_lat)
        lon = float(raw_lon)
    except (TypeError, ValueError):
        log.warning("Rejected FIRMS row with non-numeric coordinates: lat=%s lon=%s", raw_lat, raw_lon)
        return None

    # Spatial range check
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        log.warning("Rejected FIRMS row with out-of-bounds coordinates: lat=%s lon=%s", lat, lon)
        return None

    # Acquired timestamp check
    acq_date = str(raw.get("acq_date", raw.get("ACQ_DATE", ""))).strip()
    acq_time = str(raw.get("acq_time", raw.get("ACQ_TIME", "0000"))).strip().zfill(4)

    acquired_at = None
    if acq_date:
        try:
            acquired_at = datetime.strptime(f"{acq_date} {acq_time}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
        except Exception:
            acquired_at = None

    if acquired_at is None:
        raw_acq = raw.get("acquired_at")
        if isinstance(raw_acq, str):
            try:
                acquired_at = datetime.fromisoformat(raw_acq.replace("Z", "+00:00"))
            except Exception:
                acquired_at = None

    if acquired_at is None:
        acquired_at = datetime.now(timezone.utc)

    # Sanitize numeric fields: brightness & FRP
    brightness = _f(raw.get("brightness_k", raw.get("brightness", raw.get("BRIGHTNESS", raw.get("bright_ti4")))))
    if brightness is not None and (brightness <= 0 or brightness > 2000):
        log.warning("Sanitizing anomalous brightness_k=%s at lat=%s lon=%s", brightness, lat, lon)
        brightness = None

    frp = _f(raw.get("frp_mw", raw.get("frp", raw.get("FRP"))))
    if frp is not None and (frp < 0 or frp > 100000):
        log.warning("Sanitizing negative or anomalous frp_mw=%s at lat=%s lon=%s", frp, lat, lon)
        frp = None

    return {
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "acq_date": acq_date,
        "acq_time": acq_time,
        "acquired_at": acquired_at,
        "brightness_k": brightness,
        "frp_mw": frp,
    }


def normalize_observation(raw: dict[str, Any], default_source: str = "VIIRS") -> dict[str, Any] | None:
    """Validate, sanitize, and normalize heterogeneous FIRMS records into internal schema."""
    cleaned = sanitize_and_validate_row(raw)
    if cleaned is None:
        return None

    conf = normalize_confidence(raw.get("confidence", raw.get("Confidence", raw.get("conf"))))
    dn = raw.get("daynight", raw.get("DayNight", raw.get("day_night", "D")))
    dn = str(dn).upper()[0] if dn else "D"
    if dn not in ("D", "N"):
        dn = "D"

    # Sanitize raw_payload: convert datetimes -> isoformat strings
    clean_raw = {}
    for k, v in raw.items():
        if isinstance(v, datetime):
            clean_raw[k] = v.isoformat()
        else:
            clean_raw[k] = v

    return {
        "latitude": cleaned["latitude"],
        "longitude": cleaned["longitude"],
        "acquired_at": cleaned["acquired_at"],
        "brightness_k": cleaned["brightness_k"],
        "frp_mw": cleaned["frp_mw"],
        "confidence": str(raw.get("confidence", raw.get("Confidence", ""))),
        "confidence_raw": conf["confidence_raw"],
        "confidence_level": conf["confidence_level"],
        "confidence_numeric": conf["confidence_numeric"],
        "daynight": dn,
        "satellite": str(raw.get("satellite", raw.get("SATELLITE", "VIIRS"))),
        "instrument": str(raw.get("instrument", raw.get("INSTRUMENT", default_source))),
        "scan_km": _f(raw.get("scan_km", raw.get("SCAN"))),
        "track_km": _f(raw.get("track_km", raw.get("TRACK"))),
        "source": str(raw.get("source", default_source)),
        "raw_payload": clean_raw,
    }


class FirmsService:
    """Secure, resilient NASA FIRMS API client with exponential backoff and caching."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.cache = get_cache()

    @property
    def enabled(self) -> bool:
        return bool(self.settings.active_firms_key)

    def _url(self, source: str, bbox: str, day_range: int) -> str:
        base = self.settings.FIRMS_API_BASE_URL.rstrip("/")
        # URL constructed with key, but never logged or leaked to frontend
        return f"{base}/area/csv/{self.settings.active_firms_key}/{source}/{bbox}/{day_range}"

    def _fetch_csv_with_retry(self, source: str, bbox: str, day_range: int) -> str:
        """Synchronous HTTP GET with exponential backoff retry (max 3 retries)."""
        url = self._url(source, bbox, day_range)
        max_retries = 3
        timeout = self.settings.FIRMS_TIMEOUT_S

        for attempt in range(1, max_retries + 1):
            try:
                with httpx.Client(timeout=timeout) as client:
                    response = client.get(url)
                    # FIRMS returns 200 with text body or HTTP errors
                    if response.status_code == 429:
                        wait_time = min(2 ** attempt, 8)
                        log.warning("FIRMS rate limit hit (429). Backing off %ss (attempt %s/%s)", wait_time, attempt, max_retries)
                        time.sleep(wait_time)
                        continue
                    if response.status_code >= 500:
                        wait_time = min(2 ** attempt, 8)
                        log.warning("FIRMS server error (%s). Backing off %ss (attempt %s/%s)", response.status_code, wait_time, attempt, max_retries)
                        time.sleep(wait_time)
                        continue

                    response.raise_for_status()
                    text = response.text
                    if "Invalid MAP_KEY" in text or "Bad MAP_KEY" in text or "does not exist" in text:
                        log.error("NASA FIRMS rejected MAP_KEY: %s", text.strip())
                        raise ValueError(f"NASA FIRMS API error: {text.strip()}")
                    return text
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                wait_time = min(2 ** attempt, 8)
                log.warning("FIRMS connection/timeout error: %s. Backing off %ss (attempt %s/%s)", type(e).__name__, wait_time, attempt, max_retries)
                if attempt == max_retries:
                    raise
                time.sleep(wait_time)

        raise RuntimeError("FIRMS fetch failed after max retries")

    async def _fetch_csv_async_with_retry(self, source: str, bbox: str, day_range: int) -> str:
        """Asynchronous HTTP GET with exponential backoff retry (max 3 retries)."""
        url = self._url(source, bbox, day_range)
        max_retries = 3
        timeout = self.settings.FIRMS_TIMEOUT_S

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(url)
                    if response.status_code == 429:
                        wait_time = min(2 ** attempt, 8)
                        log.warning("FIRMS rate limit hit (429). Backing off %ss (attempt %s/%s)", wait_time, attempt, max_retries)
                        await asyncio.sleep(wait_time)
                        continue
                    if response.status_code >= 500:
                        wait_time = min(2 ** attempt, 8)
                        log.warning("FIRMS server error (%s). Backing off %ss (attempt %s/%s)", response.status_code, wait_time, attempt, max_retries)
                        await asyncio.sleep(wait_time)
                        continue

                    response.raise_for_status()
                    text = response.text
                    if "Invalid MAP_KEY" in text or "Bad MAP_KEY" in text or "does not exist" in text:
                        log.error("NASA FIRMS rejected MAP_KEY: %s", text.strip())
                        raise ValueError(f"NASA FIRMS API error: {text.strip()}")
                    return text
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                wait_time = min(2 ** attempt, 8)
                log.warning("FIRMS async connection/timeout error: %s. Backing off %ss (attempt %s/%s)", type(e).__name__, wait_time, attempt, max_retries)
                if attempt == max_retries:
                    raise
                await asyncio.sleep(wait_time)

        raise RuntimeError("FIRMS async fetch failed after max retries")

    def _parse_csv(self, csv_text: str, source: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        reader = csv.DictReader(io.StringIO(csv_text))
        for row in reader:
            normalized = normalize_observation(dict(row), default_source=source)
            if normalized is not None:
                # Convert acquired_at to isoformat string for cache serialization
                if isinstance(normalized["acquired_at"], datetime):
                    normalized["acquired_at"] = normalized["acquired_at"].isoformat()
                results.append(normalized)
        return results

    def _fetch_csv(self, source: str, bbox: str, day_range: int) -> list[dict[str, Any]]:
        if not self.enabled:
            raise RuntimeError("FIRMS live mode is disabled (no API key or ENABLE_LIVE_FIRMS=false)")

        cache_key = f"firms:{source}:{bbox}:{day_range}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            log.info("FIRMS cache HIT source=%s bbox=%s days=%s (cached %s records)", source, bbox, day_range, len(cached))
            # Rehydrate datetime
            for item in cached:
                if isinstance(item.get("acquired_at"), str):
                    item["acquired_at"] = datetime.fromisoformat(item["acquired_at"])
            return cached

        log.info("FIRMS cache MISS — fetching external source=%s bbox=%s days=%s", source, bbox, day_range)
        csv_text = self._fetch_csv_with_retry(source, bbox, day_range)
        parsed = self._parse_csv(csv_text, source=source)

        # Cache valid parsed results for 15 minutes (900 seconds)
        self.cache.set(cache_key, parsed, ttl_seconds=900)

        # Rehydrate datetimes for immediate caller
        for item in parsed:
            if isinstance(item.get("acquired_at"), str):
                item["acquired_at"] = datetime.fromisoformat(item["acquired_at"])
        return parsed

    async def fetch_area_csv_async(self, source: str, bbox: str, day_range: int) -> list[dict[str, Any]]:
        """Async fetch with caching, retry, and input sanitization."""
        if not self.enabled:
            raise RuntimeError("FIRMS live mode is disabled (no API key or ENABLE_LIVE_FIRMS=false)")

        cache_key = f"firms:{source}:{bbox}:{day_range}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            for item in cached:
                if isinstance(item.get("acquired_at"), str):
                    item["acquired_at"] = datetime.fromisoformat(item["acquired_at"])
            return cached

        csv_text = await self._fetch_csv_async_with_retry(source, bbox, day_range)
        parsed = self._parse_csv(csv_text, source=source)
        self.cache.set(cache_key, parsed, ttl_seconds=900)

        for item in parsed:
            if isinstance(item.get("acquired_at"), str):
                item["acquired_at"] = datetime.fromisoformat(item["acquired_at"])
        return parsed

    def get_recent_events(self, source: str = "VIIRS_SNPP_NRT", day_range: int = 1) -> list[dict[str, Any]]:
        return self._fetch_csv(source, "-180,-90,180,90", day_range)

    def get_events_by_area(self, min_lon: float, min_lat: float, max_lon: float, max_lat: float,
                           source: str = "VIIRS_SNPP_NRT", day_range: int = 2) -> list[dict[str, Any]]:
        return self._fetch_csv(source, f"{min_lon},{min_lat},{max_lon},{max_lat}", day_range)

    def get_events_by_date(self, day_range: int = 7, source: str = "VIIRS_SNPP_NRT") -> list[dict[str, Any]]:
        return self._fetch_csv(source, "-180,-90,180,90", day_range)

    def get_event_history(self, lat: float, lon: float, radius_km: float = 2.0,
                          source: str = "VIIRS_SNPP_NRT", day_range: int = 7) -> list[dict[str, Any]]:
        obs = self._fetch_csv(source, "68,6,98,38", day_range)
        from app.services.geo_service import haversine_km
        return [o for o in obs if haversine_km(lat, lon, o["latitude"], o["longitude"]) <= radius_km]

    def get_fallback_events(self, limit: int = 50) -> list[dict[str, Any]]:
        """Realistic fallback thermal events for demo or offline operation."""
        from datetime import timedelta
        curated = [
            {"id": "EVT-JAM01", "latitude": 22.4707, "longitude": 70.0577, "brightness_k": 348.5,
             "frp_mw": 32.4, "confidence": "high", "confidence_numeric": 90.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Persistent Source", "risk_score": 78, "risk_level": "HIGH",
             "region": "Jamnagar Refinery Cluster, Gujarat"},
            {"id": "EVT-DAH02", "latitude": 21.7125, "longitude": 72.5842, "brightness_k": 395.2,
             "frp_mw": 142.8, "confidence": "high", "confidence_numeric": 95.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Accidental Fire", "risk_score": 92, "risk_level": "CRITICAL",
             "region": "Dahej Petrochemical SEZ, Gujarat"},
            {"id": "EVT-VIZ03", "latitude": 17.6868, "longitude": 83.2185, "brightness_k": 352.0,
             "frp_mw": 48.0, "confidence": "high", "confidence_numeric": 85.0, "daynight": "D",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Thermal Source", "risk_score": 74, "risk_level": "HIGH",
             "region": "Vizag Industrial Belt, Andhra Pradesh"},
            {"id": "EVT-BOK04", "latitude": 23.6693, "longitude": 86.1511, "brightness_k": 339.4,
             "frp_mw": 29.5, "confidence": "nominal", "confidence_numeric": 65.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Persistent Source", "risk_score": 68, "risk_level": "HIGH",
             "region": "Bokaro Steel Complex, Jharkhand"},
            {"id": "EVT-PAR05", "latitude": 20.3164, "longitude": 86.6085, "brightness_k": 330.1,
             "frp_mw": 21.0, "confidence": "nominal", "confidence_numeric": 60.0, "daynight": "D",
             "satellite": "MODIS", "instrument": "MODIS", "source": "MODIS",
             "classification": "Industrial Thermal Source", "risk_score": 62, "risk_level": "HIGH",
             "region": "Paradip Port Area, Odisha"},
            {"id": "EVT-SIM06", "latitude": 21.9056, "longitude": 86.3417, "brightness_k": 368.0,
             "frp_mw": 85.2, "confidence": "high", "confidence_numeric": 90.0, "daynight": "D",
             "satellite": "MODIS", "instrument": "MODIS", "source": "MODIS",
             "classification": "Wildfire", "risk_score": 84, "risk_level": "HIGH",
             "region": "Similipal Forest Range, Odisha"},
            {"id": "EVT-PUN07", "latitude": 30.2458, "longitude": 75.8421, "brightness_k": 318.4,
             "frp_mw": 11.6, "confidence": "nominal", "confidence_numeric": 60.0, "daynight": "D",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Agricultural Burning", "risk_score": 38, "risk_level": "LOW",
             "region": "Sangrur Cropland, Punjab"},
            {"id": "EVT-MAT08", "latitude": 27.4924, "longitude": 77.6737, "brightness_k": 344.2,
             "frp_mw": 25.8, "confidence": "high", "confidence_numeric": 80.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Gas Flare", "risk_score": 58, "risk_level": "MODERATE",
             "region": "Mathura Refinery Zone, Uttar Pradesh"},
            {"id": "EVT-HAL09", "latitude": 22.0257, "longitude": 88.0583, "brightness_k": 336.8,
             "frp_mw": 19.4, "confidence": "nominal", "confidence_numeric": 65.0, "daynight": "D",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Thermal Source", "risk_score": 55, "risk_level": "MODERATE",
             "region": "Haldia Industrial Complex, West Bengal"},
            {"id": "EVT-MAN10", "latitude": 12.9141, "longitude": 74.8560, "brightness_k": 341.0,
             "frp_mw": 23.0, "confidence": "high", "confidence_numeric": 75.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Gas Flare", "risk_score": 52, "risk_level": "MODERATE",
             "region": "Mangalore Petrochemicals, Karnataka"},
            {"id": "EVT-KOC11", "latitude": 9.9312, "longitude": 76.2673, "brightness_k": 332.5,
             "frp_mw": 18.2, "confidence": "nominal", "confidence_numeric": 60.0, "daynight": "D",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Thermal Source", "risk_score": 48, "risk_level": "MODERATE",
             "region": "Kochi Industrial Area, Kerala"},
            {"id": "EVT-BAT12", "latitude": 30.2110, "longitude": 74.9455, "brightness_k": 345.6,
             "frp_mw": 28.0, "confidence": "high", "confidence_numeric": 82.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Industrial Persistent Source", "risk_score": 65, "risk_level": "HIGH",
             "region": "Bathinda Refinery, Punjab"},
            {"id": "EVT-BIN13", "latitude": 24.1785, "longitude": 78.9345, "brightness_k": 338.0,
             "frp_mw": 22.5, "confidence": "nominal", "confidence_numeric": 70.0, "daynight": "N",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Gas Flare", "risk_score": 54, "risk_level": "MODERATE",
             "region": "Bina Refinery, Madhya Pradesh"},
            {"id": "EVT-BAR14", "latitude": 26.2145, "longitude": 71.3852, "brightness_k": 315.0,
             "frp_mw": 9.5, "confidence": "low", "confidence_numeric": 35.0, "daynight": "D",
             "satellite": "VIIRS", "instrument": "VIIRS", "source": "VIIRS",
             "classification": "Unknown", "risk_score": 28, "risk_level": "LOW",
             "region": "Barmer Basin, Rajasthan"},
        ]
        now = datetime.now(timezone.utc)
        results = []
        for i, item in enumerate(curated[:limit]):
            acq = now - timedelta(hours=i * 2 + 1)
            row = dict(item)
            row["acq_date"] = acq.strftime("%Y-%m-%d")
            row["acq_time"] = acq.strftime("%H%M")
            row["acquired_at"] = acq
            results.append(row)
        return results

    def fetch_fires_with_fallback(
        self,
        bbox: str = "68,6,98,38",
        day_range: int = 1,
        source: str = "VIIRS_SNPP_NRT",
        limit: int = 500,
    ) -> tuple[list[dict[str, Any]], str, str | None]:
        """Fetch real FIRMS data if key is available, with seamless graceful fallback."""
        if not self.enabled:
            return (
                self.get_fallback_events(limit),
                "demo",
                "FIRMS_API_KEY not configured. Running in offline/demo fallback mode.",
            )
        try:
            fires = self._fetch_csv(source=source, bbox=bbox, day_range=day_range)
            # If 1-day yields 0 events for this regional bbox (e.g. between satellite passes),
            # check the 3-day satellite pass window to retrieve real active thermal events
            if not fires and day_range < 3:
                log.info("FIRMS returned 0 events for bbox=%s at day_range=%s; checking 3-day satellite pass window", bbox, day_range)
                fires = self._fetch_csv(source=source, bbox=bbox, day_range=3)

            # If still 0 events, try VIIRS_NOAA20_NRT 3-day
            if not fires:
                log.info("Checking secondary satellite VIIRS_NOAA20_NRT 3-day window for bbox=%s", bbox)
                try:
                    fires = self._fetch_csv(source="VIIRS_NOAA20_NRT", bbox=bbox, day_range=3)
                except Exception as ex_noaa:
                    log.warning("Secondary satellite check error: %s", ex_noaa)

            if not fires:
                log.info("FIRMS confirmed 0 active thermal anomalies for bbox=%s in the satellite observation window", bbox)
                return (
                    [],
                    "live",
                    "No fire hotspots currently detected in requested area in current satellite window.",
                )
            return fires[:limit], "live", None
        except Exception as e:
            log.warning("FIRMS live fetch error (%s).", e)
            return (
                self.get_fallback_events(limit),
                "demo",
                f"FIRMS API connection error: {str(e)}. Using fallback demo data.",
            )
