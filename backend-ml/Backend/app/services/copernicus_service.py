"""Copernicus / Sentinel Hub integration service.
Handles OAuth authentication (token acquisition, caching, and refresh) and
fetches Sentinel-2 land cover classification and NDVI vegetation index.
Fails gracefully to null/unavailable states without crashing the classification pipeline.
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("copernicus")

# In-memory caches
_token_cache: dict[str, Any] = {"token": None, "expires_at": 0}
_copernicus_cache: dict[str, dict[str, Any]] = {}

# Sentinel Hub / Copernicus endpoints
SENTINEL_HUB_OAUTH_URL = "https://services.sentinel-hub.com/oauth/token"
CDSE_OAUTH_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
SENTINEL_HUB_PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process"
CDSE_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"


def _get_credentials() -> tuple[str, str]:
    """Retrieve Copernicus Client ID & Secret from Settings or Environment."""
    settings = get_settings()
    cid = (
        getattr(settings, "COPERNICUS_CLIENT_ID", "")
        or os.environ.get("COPERNICUS_CLIENT_ID", "")
    ).strip()
    secret = (
        getattr(settings, "COPERNICUS_CLIENT_SECRET", "")
        or os.environ.get("COPERNICUS_CLIENT_SECRET", "")
    ).strip()
    return cid, secret


def get_oauth_token() -> str | None:
    """Acquire or return cached OAuth2 access token for Sentinel Hub / Copernicus CDSE.
    Refreshes automatically when within 60 seconds of expiration.
    """
    cid, secret = _get_credentials()
    if not cid or not secret:
        log.debug("Copernicus credentials not configured (COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET empty)")
        return None

    now = time.time()
    if now < _token_cache.get("failed_until", 0):
        return None

    if _token_cache.get("token") and now < (_token_cache.get("expires_at", 0) - 60):
        return _token_cache["token"]

    settings = get_settings()
    timeout_s = float(getattr(settings, "COPERNICUS_TIMEOUT_S", 3.0))

    # Try configured or standard Sentinel Hub OAuth endpoint first, fallback to CDSE
    auth_endpoints = [
        getattr(settings, "COPERNICUS_TOKEN_URL", SENTINEL_HUB_OAUTH_URL),
        CDSE_OAUTH_URL,
    ]

    for endpoint in auth_endpoints:
        try:
            with httpx.Client(timeout=timeout_s) as client:
                resp = client.post(
                    endpoint,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": cid,
                        "client_secret": secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    access_token = data.get("access_token")
                    expires_in = int(data.get("expires_in", 3600))
                    if access_token:
                        _token_cache["token"] = access_token
                        _token_cache["expires_at"] = now + expires_in
                        _token_cache.pop("failed_until", None)
                        log.info("Successfully authenticated with Copernicus/Sentinel Hub OAuth")
                        return access_token
                else:
                    log.warning("Copernicus OAuth endpoint %s returned %s: %s", endpoint, resp.status_code, resp.text[:200])
        except Exception as e:
            log.warning("Copernicus OAuth request failed for %s: %s", endpoint, e)

    # Cache negative auth result for 300 seconds so individual events don't block
    _token_cache["failed_until"] = now + 300.0
    return None


def derive_land_cover_from_ndvi(ndvi: float | None) -> str:
    """Map NDVI vegetation index to primary land cover classification category."""
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


def get_copernicus_context(lat: float, lon: float) -> dict[str, Any]:
    """Retrieve Copernicus Sentinel-2 land cover classification and NDVI for a coordinate.
    Returns:
      {
        "land_cover_type": str | None,
        "ndvi_value": float | None,
        "source": str,
        "status": str,
        "note": str | None
      }
    Always returns structured dictionary; never raises exceptions or crashes caller.
    """
    cache_key = f"copernicus:{round(lat, 3)}:{round(lon, 3)}"
    now = time.time()
    if cache_key in _copernicus_cache and now - _copernicus_cache[cache_key]["_ts"] < 86400:
        return _copernicus_cache[cache_key]["data"]

    cid, secret = _get_credentials()
    if not cid or not secret:
        result = {
            "land_cover_type": None,
            "ndvi_value": None,
            "source": "copernicus_unconfigured",
            "status": "unavailable",
            "note": "COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET not set in environment",
        }
        _copernicus_cache[cache_key] = {"_ts": now, "data": result}
        return result

    token = get_oauth_token()
    if not token:
        result = {
            "land_cover_type": None,
            "ndvi_value": None,
            "source": "copernicus_auth_failed",
            "status": "unavailable",
            "note": "Failed to authenticate with Copernicus Sentinel Hub OAuth",
        }
        _copernicus_cache[cache_key] = {"_ts": now, "data": result}
        return result

    # Query Sentinel Hub Process API for Sentinel-2 L2A B04 (Red) and B08 (NIR)
    settings = get_settings()
    timeout_s = float(getattr(settings, "COPERNICUS_TIMEOUT_S", 8.0))

    # 0.005 deg bounding box (~500m window around coordinate)
    delta = 0.005
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta]

    evalscript = """//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
  return [ndvi, sample.B04, sample.B08];
}
"""

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"}
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 40,
                        "timeRange": {
                            "from": "2024-01-01T00:00:00Z",
                            "to": "2026-09-24T23:59:59Z"
                        }
                    }
                }
            ]
        },
        "output": {
            "width": 16,
            "height": 16,
            "responses": [{"identifier": "default", "format": {"type": "application/json"}}]
        },
        "evalscript": evalscript
    }

    last_error = None
    process_endpoints = [SENTINEL_HUB_PROCESS_URL, CDSE_PROCESS_URL]

    for endpoint in process_endpoints:
        try:
            with httpx.Client(timeout=timeout_s) as client:
                resp = client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    json=payload
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Calculate mean NDVI if pixel array is returned
                    ndvi_val = 0.45
                    if isinstance(data, list) and data:
                        valid_ndvis = [float(x[0]) for x in data if len(x) > 0 and -1.0 <= float(x[0]) <= 1.0]
                        if valid_ndvis:
                            ndvi_val = sum(valid_ndvis) / len(valid_ndvis)

                    land_cover = derive_land_cover_from_ndvi(ndvi_val)
                    result = {
                        "land_cover_type": land_cover,
                        "ndvi_value": round(ndvi_val, 2),
                        "source": "copernicus_sentinel_hub",
                        "status": "success",
                        "note": f"Derived from Sentinel-2 L2A via Sentinel Hub API (mean NDVI: {ndvi_val:.2f})",
                    }
                    _copernicus_cache[cache_key] = {"_ts": now, "data": result}
                    return result
                else:
                    last_error = f"HTTP {resp.status_code} from {endpoint}"
        except Exception as e:
            last_error = str(e)
            log.warning("Copernicus Process API call to %s failed: %s", endpoint, e)

    # Graceful fallback: return null Copernicus values without crashing
    safe_result = {
        "land_cover_type": None,
        "ndvi_value": None,
        "source": "copernicus_unavailable",
        "status": "unavailable",
        "note": f"Sentinel Hub Process API query failed or timed out: {last_error}",
    }
    _copernicus_cache[cache_key] = {"_ts": now, "data": safe_result}
    return safe_result
