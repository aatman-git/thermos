"""ESA WorldCover WMS Land Cover Service.
Integrates with the public ESA WorldCover 2021 Web Map Service (WMS) to retrieve
10-meter global land cover classification and representative vegetation index (NDVI).
Requires NO API key, NO credentials, and NO OAuth authentication.
Fails gracefully to structured fallback dictionaries on network timeouts or errors.
"""
from __future__ import annotations

import math
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("worldcover")

# In-memory cache keyed by rounded coordinate (lat_3dec, lon_3dec), 24h TTL
_land_cover_cache: dict[str, dict[str, Any]] = {}
# Alias for backward compatibility
_copernicus_cache = _land_cover_cache

# ESA WorldCover Public WMS Endpoints
# Primary: user-specified endpoint on Terrascope
PRIMARY_WMS_URL = "https://services.terrascope.be/wms/v2"
PRIMARY_LAYER = "WORLDCOVER_2021_MAP"

# Active Terrascope Titiler WMS endpoint (official live replacement infrastructure)
TITILER_WMS_URL = "https://titiler.terrascope.be/wms"
TITILER_LAYER = "esa-worldcover-map-10m-2021-v2_map"

# 11 Official ESA WorldCover 2021 Classes & Legend
# Map: RGB tuple -> (class_code, raw_class_name, normalized_land_cover_type, representative_ndvi)
ESA_PALETTE: dict[tuple[int, int, int], tuple[int, str, str, float]] = {
    (0, 100, 0): (10, "Tree cover", "dense_forest", 0.72),
    (255, 187, 34): (20, "Shrubland", "shrubland", 0.28),
    (255, 255, 76): (30, "Grassland", "grassland", 0.32),
    (240, 150, 255): (40, "Cropland", "cropland", 0.45),
    (250, 0, 0): (50, "Built-up", "built_up", 0.12),
    (180, 180, 180): (60, "Bare / sparse vegetation", "bare_sparse_vegetation", 0.06),
    (240, 240, 240): (70, "Snow and ice", "snow_ice", -0.05),
    (0, 100, 200): (80, "Permanent water bodies", "water_body", -0.15),
    (0, 150, 160): (90, "Herbaceous wetland", "wetland", 0.40),
    (0, 207, 117): (95, "Mangroves", "mangroves", 0.65),
    (250, 230, 160): (100, "Moss and lichen", "moss_lichen", 0.20),
}

# Lookup by integer class code
ESA_CLASS_CODES: dict[int, tuple[str, str, float]] = {
    10: ("Tree cover", "dense_forest", 0.72),
    20: ("Shrubland", "shrubland", 0.28),
    30: ("Grassland", "grassland", 0.32),
    40: ("Cropland", "cropland", 0.45),
    50: ("Built-up", "built_up", 0.12),
    60: ("Bare / sparse vegetation", "bare_sparse_vegetation", 0.06),
    70: ("Snow and ice", "snow_ice", -0.05),
    80: ("Permanent water bodies", "water_body", -0.15),
    90: ("Herbaceous wetland", "wetland", 0.40),
    95: ("Mangroves", "mangroves", 0.65),
    100: ("Moss and lichen", "moss_lichen", 0.20),
}


def _match_rgb_to_class(r: int, g: int, b: int) -> tuple[int, str, str, float]:
    """Find closest ESA WorldCover class by Euclidean distance in RGB color space."""
    best_dist = float("inf")
    best_match = (50, "Built-up", "built_up", 0.12)
    for (pr, pg, pb), entry in ESA_PALETTE.items():
        dist = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
        if dist < best_dist:
            best_dist = dist
            best_match = entry
            if dist == 0:
                break
    return best_match


def derive_land_cover_from_ndvi(ndvi: float | None) -> str:
    """Map NDVI vegetation index to primary land cover classification category.
    Retained for backward compatibility with existing tests and pipelines.
    """
    if ndvi is None:
        return "unclassified"
    if ndvi >= 0.60:
        return "dense_forest"
    if ndvi >= 0.35:
        return "cropland"
    if ndvi >= 0.18:
        return "grassland"
    if ndvi >= 0.05:
        return "built_up"
    if ndvi < 0:
        return "water_body"
    return "bare_land"


def _query_wms_feature_info(
    client: httpx.Client,
    base_url: str,
    layer: str,
    lat: float,
    lon: float,
    i: int = 5,
    j: int = 5,
    timeout_s: float = 10.0,
) -> tuple[int, str, str, float] | None:
    """Execute a WMS GetFeatureInfo request against an ESA WorldCover endpoint."""
    delta = 0.001
    min_lat, max_lat = lat - delta, lat + delta
    min_lon, max_lon = lon - delta, lon + delta

    # Build standard OGC WMS 1.3.0 GetFeatureInfo parameters
    params: dict[str, str] = {
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": layer,
        "QUERY_LAYERS": layer,
        "STYLES": "",
        "FORMAT": "image/png",
        "CRS": "EPSG:4326",
        "BBOX": f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}",
        "WIDTH": "11",
        "HEIGHT": "11",
        "I": str(i),
        "J": str(j),
        "INFO_FORMAT": "application/geo+json" if "titiler" in base_url else "application/json",
    }

    if "titiler" in base_url:
        params["TIME"] = "2021-01-01"

    headers = {
        "User-Agent": "THERMOS-WorldCover-Client/1.0 (Earth Observation Land Cover)",
        "Accept": "application/geo+json, application/json, text/plain, */*",
    }

    resp = client.get(base_url, params=params, headers=headers, timeout=timeout_s)
    if resp.status_code != 200:
        log.debug("WMS %s returned status %s: %s", base_url, resp.status_code, resp.text[:150])
        return None

    # Parse GeoJSON or JSON response
    try:
        data = resp.json()
    except Exception:
        # Fallback text parsing if not JSON
        text = resp.text
        for code, (name, norm, ndvi) in ESA_CLASS_CODES.items():
            if name.lower() in text.lower():
                return code, name, norm, ndvi
        return None

    props = {}
    if isinstance(data, dict):
        features = data.get("features", [])
        if features and isinstance(features[0], dict):
            props = features[0].get("properties", {})
        else:
            props = data.get("properties", data)

    # Check for direct RGB bands
    b1 = props.get("band_1")
    b2 = props.get("band_2")
    b3 = props.get("band_3")
    if b1 is not None and b2 is not None and b3 is not None:
        return _match_rgb_to_class(int(b1), int(b2), int(b3))

    # Check for integer class code attributes (e.g. 'GRAY_INDEX', 'value', 'class', 'code')
    for key in ("GRAY_INDEX", "value", "class", "code", "label"):
        if key in props and props[key] is not None:
            try:
                val = int(props[key])
                if val in ESA_CLASS_CODES:
                    name, norm, ndvi = ESA_CLASS_CODES[val]
                    return val, name, norm, ndvi
            except (ValueError, TypeError):
                pass

    return None


def get_land_cover_context(lat: float, lon: float) -> dict[str, Any]:
    """Retrieve ESA WorldCover 2021 land cover classification for a coordinate.
    Queries the public ESA WorldCover WMS endpoint (no authentication required).
    Returns:
      {
        "land_cover_type": str,      # e.g. "dense_forest", "built_up", "cropland", "bare_sparse_vegetation"
        "ndvi_value": float | None,  # representative NDVI value
        "raw_class": str | None,     # official ESA WorldCover class name (e.g. "Built-up")
        "class_code": int | None,    # official ESA WorldCover class code (e.g. 50)
        "source": str,               # "esa_worldcover_wms"
        "status": str,               # "success" or "unavailable"
        "note": str | None           # provenance detail or failure explanation
      }
    Always returns a structured dictionary; never raises exceptions or crashes the caller.
    """
    cache_key = f"worldcover:{round(lat, 3)}:{round(lon, 3)}"
    now = time.time()
    if cache_key in _land_cover_cache and (now - _land_cover_cache[cache_key]["_ts"] < 86400):
        return _land_cover_cache[cache_key]["data"]

    settings = get_settings()
    timeout_s = float(getattr(settings, "WORLDCOVER_TIMEOUT_S", 10.0))

    # WMS endpoint priority list: primary Terrascope v2 endpoint, followed by active Titiler endpoint
    primary_url = getattr(settings, "WORLDCOVER_WMS_URL", PRIMARY_WMS_URL)
    primary_layer = getattr(settings, "WORLDCOVER_LAYER", PRIMARY_LAYER)
    fallback_url = getattr(settings, "WORLDCOVER_WMS_FALLBACK_URL", TITILER_WMS_URL)
    fallback_layer = getattr(settings, "WORLDCOVER_FALLBACK_LAYER", TITILER_LAYER)

    endpoints = [
        (primary_url, primary_layer),
        (fallback_url, fallback_layer),
    ]

    _endpoint_failed_until: dict[str, float] = getattr(get_land_cover_context, "_endpoint_failed_until", {})
    setattr(get_land_cover_context, "_endpoint_failed_until", _endpoint_failed_until)

    last_error: str | None = None
    classified: tuple[int, str, str, float] | None = None

    for base_url, layer in endpoints:
        if now < _endpoint_failed_until.get(base_url, 0):
            continue

        try:
            with httpx.Client(timeout=timeout_s, follow_redirects=True) as client:
                # 1. Query center point (I=5, J=5)
                classified = _query_wms_feature_info(
                    client=client,
                    base_url=base_url,
                    layer=layer,
                    lat=lat,
                    lon=lon,
                    i=5,
                    j=5,
                    timeout_s=timeout_s,
                )

                # 2. Industrial / built-up boundary refinement:
                # If the center pixel is shrubland or bare vegetation inside a mixed window,
                # check cardinal offset (I=3, J=5, ~40m west) within the ±0.001 deg bounding box.
                # If built-up infrastructure is immediately adjacent, classify as built_up.
                if classified is not None and classified[0] in (20, 60):
                    adjacent = _query_wms_feature_info(
                        client=client,
                        base_url=base_url,
                        layer=layer,
                        lat=lat,
                        lon=lon,
                        i=3,
                        j=5,
                        timeout_s=min(timeout_s, 5.0),
                    )
                    if adjacent is not None and adjacent[0] == 50:
                        classified = adjacent

                if classified is not None:
                    # Endpoint succeeded; clear any failure timestamp
                    _endpoint_failed_until.pop(base_url, None)
                    break
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
            _endpoint_failed_until[base_url] = now + 300.0  # cool off for 5 minutes
            log.warning("ESA WorldCover WMS query to %s failed: %s", base_url, e)

    if classified is not None:
        class_code, raw_name, norm_type, ndvi_val = classified
        result = {
            "land_cover_type": norm_type,
            "ndvi_value": ndvi_val,
            "raw_class": raw_name,
            "class_code": class_code,
            "source": "esa_worldcover_wms",
            "status": "success",
            "note": f"ESA WorldCover 2021 WMS: {raw_name} (class {class_code})",
        }
        _land_cover_cache[cache_key] = {"_ts": now, "data": result}
        return result

    # Safe fallback if all WMS queries timed out or failed
    fallback_result = {
        "land_cover_type": "unknown",
        "ndvi_value": None,
        "raw_class": "Unknown",
        "class_code": None,
        "source": "esa_worldcover_wms",
        "status": "unavailable",
        "note": f"ESA WorldCover WMS query failed or timed out: {last_error}",
    }
    _land_cover_cache[cache_key] = {"_ts": now, "data": fallback_result}
    return fallback_result


# Re-export get_copernicus_context and get_worldcover_context for seamless drop-in compatibility
get_copernicus_context = get_land_cover_context
get_worldcover_context = get_land_cover_context
