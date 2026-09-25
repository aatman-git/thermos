"""Land-cover + population abstractions with clearly-marked demo fallbacks."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings

_pop_cache: dict[str, dict] = {}
_lc_cache: dict[str, dict] = {}

# Deterministic demo anchors: industrial belts, mining, forests, croplands (Indian context).
_ANCHORS = [
    (23.02, 72.57, "Industrial", 18400),   # Ahmedabad industrial belt
    (22.72, 70.20, "Industrial", 9200),    # Jamnagar refinery belt
    (19.07, 72.87, "Built-up", 42000),     # Mumbai
    (28.61, 77.20, "Built-up", 52000),     # Delhi
    (23.65, 86.45, "Mining", 6800),        # Jharia coalfields
    (21.93, 85.13, "Mining", 4100),        # Odisha mining
    (21.14, 79.38, "Forest", 900),         # central India forest
    (12.97, 77.59, "Cropland", 12500),     # Karnataka cropland fringe
    (30.33, 76.38, "Cropland", 6200),      # Punjab cropland
    (21.90, 86.34, "Forest", 450),         # Similipal National Park / biosphere reserve
    (29.53, 78.77, "Forest", 350),         # Jim Corbett National Park
    (11.66, 76.62, "Forest", 600),         # Bandipur / Nilgiri biosphere reserve
    (26.85, 80.94, "Grassland", 9800),
    (25.43, 81.85, "Bare Land", 1500),
    (22.30, 73.20, "Shrubland", 2300),
]

from app.services.geo_service import haversine_km


def _nearest_anchor(lat: float, lon: float) -> tuple[str, int, float]:
    best, bd = None, None
    for alat, alon, lc, pop in _ANCHORS:
        d = haversine_km(lat, lon, alat, alon)
        if bd is None or d < bd:
            bd, best = d, (lc, pop)
    assert best is not None
    return best[0], best[1], bd  # type: ignore[return-value]


def get_land_cover(lat: float, lon: float) -> dict[str, Any]:
    settings = get_settings()
    key = f"{round(lat,3)}:{round(lon,3)}"
    if key in _lc_cache and time.time() - _lc_cache[key]["_ts"] < 86400:
        return _lc_cache[key]["data"]
    # Real raster hook: if LANDCOVER_DATA_PATH configured, a raster reader can replace this branch.
    lc, _, dist = _nearest_anchor(lat, lon)
    # Hash jitter so nearby-but-different points vary plausibly while staying deterministic.
    h = int(hashlib.md5(f"{lat:.4f},{lon:.4f}".encode()).hexdigest()[:4], 16)
    result = {"land_cover": lc, "land_cover_source": "demo-fallback",
              "land_cover_provenance": "synthetic-demo heuristic; NOT real Copernicus data",
              "is_demo": True, "anchor_distance_km": round(dist, 2), "jitter": h % 7}
    _lc_cache[key] = {"_ts": time.time(), "data": result}
    return result


def get_population(lat: float, lon: float, radius_km: float | None = None) -> dict[str, Any]:
    settings = get_settings()
    radius_km = radius_km or settings.POPULATION_RADIUS_KM
    key = f"{round(lat,3)}:{round(lon,3)}:{radius_km}"
    if key in _pop_cache and time.time() - _pop_cache[key]["_ts"] < 86400:
        return _pop_cache[key]["data"]
    _, pop, dist = _nearest_anchor(lat, lon)
    h = int(hashlib.md5(f"pop{lat:.4f},{lon:.4f}".encode()).hexdigest()[:6], 16)
    # distance-decayed population: dense near anchor, sparse far away
    decay = max(0.05, 1.0 - dist / 400.0)
    estimate = int(pop * decay + (h % 1500))
    result = {"population_5km": estimate, "population_source": "demo-fallback",
              "population_provenance": "synthetic-demo heuristic; NOT real WorldPop data",
              "population_timestamp": datetime.now(timezone.utc).isoformat(),
              "is_demo": True, "radius_km": radius_km}
    _pop_cache[key] = {"_ts": time.time(), "data": result}
    return result


def derive_proximities(lat: float, lon: float, osm: dict[str, Any]) -> dict[str, Any]:
    """Prefer OSM nearest distances; fall back to anchor-relative demo distances."""
    proximities: dict[str, float] = {}
    nearest = (osm.get("nearest") or {}) if osm.get("source_status") == "available" else {}
    mapping = {"industrial": "industrial_proximity_km", "refinery": "refinery_proximity_km",
               "mine": "mine_proximity_km", "forest": "forest_proximity_km", "farmland": "cropland_proximity_km"}
    for cat, feat in mapping.items():
        n = nearest.get(cat)
        if n:
            proximities[feat] = round(float(n["dist_km"]), 2)
    if len(proximities) < 5:
        # demo fallback relative to anchors (deterministic, clearly marked)
        h = int(hashlib.md5(f"prox{lat:.4f},{lon:.4f}".encode()).hexdigest()[:4], 16) % 100 / 100.0
        lc, _, _ = _nearest_anchor(lat, lon)
        defaults = {
            "Industrial": (1.2, 4.6, 42.0, 31.4, 18.2),
            "Built-up": (3.5, 12.0, 60.0, 25.0, 15.0),
            "Mining": (18.0, 55.0, 0.8, 12.0, 22.0),
            "Forest": (45.0, 80.0, 70.0, 0.6, 9.0),
            "Cropland": (22.0, 48.0, 65.0, 14.0, 0.5),
        }.get(lc, (10.0, 30.0, 40.0, 20.0, 12.0))
        keys = ["industrial_proximity_km", "refinery_proximity_km", "mine_proximity_km",
                "forest_proximity_km", "cropland_proximity_km"]
        for k, base in zip(keys, defaults):
            proximities.setdefault(k, round(base * (0.7 + h * 0.6), 2))
    proximities["_demo"] = len([1 for _ in [0] if osm.get("source_status") != "available"]) > 0 or \
        all(k in proximities for k in ("industrial_proximity_km",))
    return proximities
