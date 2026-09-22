"""OSM/Overpass enrichment: one combined query, cache, timeout, retry, graceful fallback."""
from __future__ import annotations

import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.geo_service import haversine_km

log = get_logger("osm")
_cache: dict[str, dict] = {}


def _key(lat: float, lon: float, r_km: float) -> str:
    return f"{round(lat,3)}:{round(lon,3)}:{r_km}"


OVERPASS_QUERY = """
[out:json][timeout:{timeout}];
(
  nw["landuse"="industrial"](around:{radius},{lat},{lon});
  nw["man_made"="works"](around:{radius},{lat},{lon});
  nw["power"="plant"](around:{radius},{lat},{lon});
  nw["industrial"="refinery"](around:{radius},{lat},{lon});
  nw["man_made"="petroleum_well"](around:{radius},{lat},{lon});
  nw["landuse"="quarry"](around:{radius},{lat},{lon});
  nw["man_made"="mine"](around:{radius},{lat},{lon});
  nw["landuse"="forest"](around:{radius},{lat},{lon});
  nw["landuse"="farmland"](around:{radius},{lat},{lon});
  nw["place"](around:{radius},{lat},{lon});
);
out center 40;
"""


def query_osm(lat: float, lon: float, radius_km: float | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.ENABLE_OSM:
        return {"source_status": "disabled", "elements": [], "counts": {}}
    radius_km = radius_km or settings.OSM_QUERY_RADIUS_KM
    ck = _key(lat, lon, radius_km)
    if ck in _cache and time.time() - _cache[ck]["_ts"] < 3600:
        return _cache[ck]["data"]
    radius_m = int(radius_km * 1000)
    q = OVERPASS_QUERY.format(timeout=int(settings.OSM_TIMEOUT_S), radius=radius_m, lat=lat, lon=lon)
    last_err = None
    for attempt in range(2):
        try:
            with httpx.Client(timeout=settings.OSM_TIMEOUT_S, headers={"User-Agent": "THERMOS-ThermalIntel/1.0"}) as c:
                r = c.post(settings.OSM_OVERPASS_URL, data={"data": q})
                r.raise_for_status()
                data = _parse(lat, lon, r.json())
                _cache[ck] = {"_ts": time.time(), "data": data}
                return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("OSM attempt %s failed: %s", attempt + 1, e)
    log.warning("OSM unavailable, graceful fallback: %s", last_err)
    return {"source_status": "unavailable", "elements": [], "counts": {}}


def _parse(lat: float, lon: float, payload: dict) -> dict[str, Any]:
    elements = payload.get("elements", [])
    cats = {"industrial": [], "refinery": [], "mine": [], "forest": [], "farmland": [], "settlement": []}
    for el in elements:
        tags = el.get("tags", {})
        clat = el.get("lat", (el.get("center") or {}).get("lat"))
        clon = el.get("lon", (el.get("center") or {}).get("lon"))
        if clat is None or clon is None:
            continue
        d = haversine_km(lat, lon, clat, clon)
        item = {"lat": clat, "lon": clon, "dist_km": round(d, 3), "tags": tags}
        lu, mm, pw = tags.get("landuse"), tags.get("man_made"), tags.get("power")
        if lu == "industrial" or mm == "works" or pw == "plant":
            cats["industrial"].append(item)
        if tags.get("industrial") == "refinery" or mm == "petroleum_well":
            cats["refinery"].append(item)
        if lu == "quarry" or mm == "mine":
            cats["mine"].append(item)
        if lu == "forest":
            cats["forest"].append(item)
        if lu == "farmland":
            cats["farmland"].append(item)
        if "place" in tags:
            cats["settlement"].append(item)
    for v in cats.values():
        v.sort(key=lambda x: x["dist_km"])
    return {"source_status": "available", "elements": elements[:40],
            "counts": {k: len(v) for k, v in cats.items()}, "nearest": {
                k: (v[0] if v else None) for k, v in cats.items()}}
