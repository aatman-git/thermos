"""NASA FIRMS Hotspots API Endpoint.
Exposes GET /api/fires with live NASA FIRMS retrieval, structured parsing,
and seamless fallback for offline/demo operation.
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Query, Response
import httpx

from app.core.cache import get_cache
from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.copernicus_service import get_copernicus_context
from app.services.ai_explainer_service import generate_fire_explanation
from app.services.firms import fetch_firms_data, get_firms_service
from app.services.osm_service import check_known_industrial_registry, get_industrial_context

router = APIRouter(tags=["fires"])
log = get_logger("routes.fires")

TRANSPARENT_1X1_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00"
    b"\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _tile_to_epsg3857_bbox(z: int, x: int, y: int) -> str:
    origin = 20037508.342789244
    n_tiles = 2 ** z
    tile_size = (2.0 * origin) / n_tiles
    minx = -origin + x * tile_size
    maxx = -origin + (x + 1) * tile_size
    maxy = origin - y * tile_size
    miny = origin - (y + 1) * tile_size
    return f"{minx},{miny},{maxx},{maxy}"


def _classify_preliminary(item: dict[str, Any]) -> tuple[str, float, str, str, dict[str, Any]]:
    """Classifies raw FIRMS hotspots using the trained XGBoost ML classifier,
    geospatial context (proximities to industry/mines/refineries/forests/croplands),
    industrial land-use context via OSM Overpass, and multi-factor risk engine.
    """
    from app.services.osm_service import check_known_industrial_registry

    lat = float(item.get("latitude") or 0.0)
    lon = float(item.get("longitude") or 0.0)
    ind_ctx = check_known_industrial_registry(lat, lon, max_radius_m=15000)
    if not ind_ctx:
        ind_ctx = {
            "is_industrial": False,
            "nearest_industrial_distance_m": None,
            "matched_tags": {},
            "element_count": 0,
            "source": "osm_regional",
            "note": "Non-industrial zone",
        }

    if item.get("classification") and item.get("risk_score"):
        score = float(item["risk_score"])
        level = item.get("risk_level") or ("HIGH" if score >= 65 else "MODERATE")
        reg = item.get("region") or f"{lat:.2f}°N, {lon:.2f}°E"
        return item["classification"], score, level, reg, ind_ctx

    frp = float(item.get("frp_mw") or item.get("frp") or 15.0)
    bright = float(item.get("brightness_k") or item.get("brightness") or 330.0)
    dn = str(item.get("daynight", "D")).upper()
    conf_num = float(item.get("confidence_numeric") or (90.0 if str(item.get("confidence")).lower() in ("h", "high") else 60.0))

    try:
        from app.ml.predictor import predict_features
        from app.services import geo_enrichment as ge
        from app.services.risk_service import calculate_risk

        lc = ge.get_land_cover(lat, lon)
        pop = ge.get_population(lat, lon)
        prox = ge.derive_proximities(lat, lon, {})

        if ind_ctx.get("is_industrial"):
            ind_dist_km = (ind_ctx.get("nearest_industrial_distance_m") or 500.0) / 1000.0
            prox["industrial_proximity_km"] = min(prox.get("industrial_proximity_km", 25.0), ind_dist_km)
            lc["land_cover"] = "Industrial"

        feat = {
            "brightness_k": bright,
            "frp_mw": frp,
            "firms_confidence_pct": conf_num,
            "daynight": 1 if dn.startswith("D") else 0,
            "observation_count_7d": int(item.get("observation_count_7d") or 2),
            "persistence_hours_7d": float(item.get("persistence_hours_7d") or 4.0),
            "frp_trend_pct": 0.0,
            "industrial_proximity_km": prox.get("industrial_proximity_km", 25.0),
            "refinery_proximity_km": prox.get("refinery_proximity_km", 35.0),
            "mine_proximity_km": prox.get("mine_proximity_km", 45.0),
            "forest_proximity_km": prox.get("forest_proximity_km", 20.0),
            "cropland_proximity_km": prox.get("cropland_proximity_km", 15.0),
            "population_5km": pop.get("population_5km", 5000),
            "land_cover": lc.get("land_cover", "Cropland"),
        }

        pred = predict_features(feat)
        risk = calculate_risk(feat)

        cls_label = pred["predicted_class"]
        raw_score = risk["risk_score"]

        # Category-calibrated operational risk score
        if cls_label == "Industrial Fire":
            risk_score = min(98.0, max(raw_score + 35.0, 72.0))
        elif cls_label == "Wildfire":
            risk_score = min(95.0, max(raw_score + 25.0, 62.0))
        elif cls_label == "Gas Flare":
            risk_score = min(85.0, max(raw_score + 20.0, 55.0))
        elif cls_label in ("Mining Activity", "Industrial Thermal Source"):
            risk_score = min(80.0, max(raw_score + 15.0, 48.0))
        else:
            risk_score = raw_score

        if risk_score >= 85.0:
            risk_level = "CRITICAL"
        elif risk_score >= 65.0:
            risk_level = "HIGH"
        elif risk_score >= 40.0:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        lc_type = lc.get("land_cover", "Regional")
        region = f"{lc_type} Zone ({lat:.2f}°N, {lon:.2f}°E)"
        return cls_label, round(risk_score), risk_level, region, ind_ctx
    except Exception as e:
        log.warning("ML inference fallback for (%s, %s): %s", lat, lon, e)
        if frp > 50.0 or bright > 380.0:
            return "Industrial Fire", 85.0, "CRITICAL", f"High Thermal Zone ({lat:.2f}°N, {lon:.2f}°E)", ind_ctx
        if dn == "N":
            cls = "Gas Flare" if bright > 340.0 else "Industrial Persistent Source"
            return cls, 65.0, "HIGH", f"Industrial Area ({lat:.2f}°N, {lon:.2f}°E)", ind_ctx
        cls = "Wildfire" if frp > 25.0 else "Agricultural Burning"
        return cls, 42.0, "MODERATE", f"Rural Area ({lat:.2f}°N, {lon:.2f}°E)", ind_ctx




@router.get("/fires")
def get_fires(
    bbox: str | None = Query(
        None,
        description="minlon,minlat,maxlon,maxlat (defaults to India bounding box: 68,6,98,38)",
    ),
    day_range: int = Query(1, ge=1, le=10, description="Acquisition day range (1-10)"),
    source: str = Query(
        "VIIRS_SNPP_NRT",
        description="Satellite source: VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, MODIS_NRT",
    ),
    limit: int = Query(500, ge=1, le=2000, description="Max hotspots to return"),
) -> dict[str, Any]:
    """Retrieve thermal hotspots from NASA FIRMS API.
    If FIRMS_API_KEY is configured and valid, queries NASA FIRMS live area CSV.
    Otherwise gracefully falls back to realistic demo data for offline/demo mode.
    """
    settings = get_settings()
    active_bbox = bbox.strip() if bbox else "68,6,98,38"

    raw_items, data_mode, error_note = fetch_firms_data(
        bbox=active_bbox,
        day_range=day_range,
        source=source,
        limit=limit,
    )

    fires: list[dict[str, Any]] = []
    features: list[dict[str, Any]] = []

    for item in raw_items:
        try:
            lat = float(item["latitude"])
            lon = float(item["longitude"])
        except (KeyError, TypeError, ValueError):
            continue

        item_id = item.get("id") or f"FIRMS-{abs(hash((lat, lon, str(item.get('acq_date')), str(item.get('acq_time'))))) % 1000000:06d}"
        bright = item.get("brightness_k") or item.get("brightness") or item.get("bright_ti4")
        frp = item.get("frp_mw") or item.get("frp")
        conf_num = item.get("confidence_numeric")
        if conf_num is None:
            c = item.get("confidence")
            try:
                conf_num = float(c) if c is not None and str(c).replace(".", "").isdigit() else (90.0 if c == "h" else 60.0)
            except (ValueError, TypeError):
                conf_num = 60.0

        acq_at = item.get("acquired_at")
        if isinstance(acq_at, datetime):
            acq_iso = acq_at.isoformat()
        elif isinstance(acq_at, str):
            acq_iso = acq_at
        else:
            acq_iso = datetime.now(timezone.utc).isoformat()

        acq_date = item.get("acq_date") or acq_iso[:10]
        acq_time = str(item.get("acq_time") or "0000").zfill(4)

        cls, risk_score, risk_level, region_name, ind_ctx = _classify_preliminary(item)
        risk_tier = risk_level.capitalize() if risk_level else "Moderate"
        persist_hrs = float(item.get("persistence_hours") or (48.0 if "Persistent" in cls else 6.0))

        # Copernicus & OSM Context enrichment (cached & resilient)
        cop_ctx = get_copernicus_context(lat, lon)
        rel_tags = ind_ctx.get("relevant_tags") or ind_ctx.get("matched_tags", {})
        osm_ctx = {
            "is_industrial": ind_ctx.get("is_industrial", False),
            "nearest_industrial_distance_m": ind_ctx.get("nearest_industrial_distance_m"),
            "relevant_tags": rel_tags,
            "matched_tags": rel_tags,
        }
        copernicus_ctx = {
            "land_cover_type": cop_ctx.get("land_cover_type"),
            "ndvi_value": cop_ctx.get("ndvi_value"),
        }

        # Optional Gemini explanation generated for high-priority incidents or when requested
        expl_text = None
        if len(fires) < 2 and risk_score >= 80.0:
            expl_text = generate_fire_explanation({
                "category": cls,
                "confidence": conf_num,
                "risk_score": round(risk_score),
                "firms": {"brightness": bright, "frp": frp},
                "osm": osm_ctx,
                "copernicus": copernicus_ctx,
            })

        # 1. Flat structured fire record (Req 1 & Req 5)
        fire_record = {
            "id": item_id,
            "latitude": lat,
            "longitude": lon,
            "brightness": round(float(bright), 2) if bright is not None else 330.0,
            "brightness_k": round(float(bright), 2) if bright is not None else 330.0,
            "confidence": conf_num,
            "confidence_raw": item.get("confidence"),
            "frp": round(float(frp), 2) if frp is not None else 15.0,
            "frp_mw": round(float(frp), 2) if frp is not None else 15.0,
            "acq_date": acq_date,
            "acq_time": acq_time,
            "acquired_at": acq_iso,
            "daynight": item.get("daynight", "D"),
            "satellite": item.get("satellite", "VIIRS"),
            "instrument": item.get("instrument", source),
            "source": item.get("source", source),
            "classification": {
                "category": cls,
                "confidence": conf_num,
                "risk_score": round(risk_score),
            },
            "category": cls,
            "risk_score": round(risk_score),
            "risk_level": risk_level,
            "risk_tier": risk_tier,
            "region": region_name,
            "firms": {
                "brightness": round(float(bright), 2) if bright is not None else 330.0,
                "frp": round(float(frp), 2) if frp is not None else 15.0,
            },
            "is_industrial": ind_ctx.get("is_industrial", False),
            "nearest_industrial_distance_m": ind_ctx.get("nearest_industrial_distance_m"),
            "relevant_tags": rel_tags,
            "matched_tags": rel_tags,
            "industrial_context": ind_ctx,
            "osm_context": osm_ctx,
            "copernicus_context": copernicus_ctx,
            "land_cover_type": cop_ctx.get("land_cover_type"),
            "ndvi_value": cop_ctx.get("ndvi_value"),
            "explanation": expl_text,
        }
        fires.append(fire_record)

        # 2. GeoJSON Feature for MapLibre / GIS
        features.append({
            "type": "Feature",
            "id": item_id,
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],  # [lng, lat] as strict numbers
            },
            "properties": {
                "id": item_id,
                "anomaly_id": item_id,
                "latitude": lat,
                "longitude": lon,
                "lat": lat,
                "lng": lon,
                "brightness": round(float(bright), 2) if bright is not None else 330.0,
                "brightness_temp": round(float(bright), 2) if bright is not None else 330.0,
                "confidence": round(conf_num),
                "frp": round(float(frp), 2) if frp is not None else 15.0,
                "acq_date": acq_date,
                "acq_time": acq_time,
                "acquired_at": acq_iso,
                "first_detected": acq_iso,
                "daynight": item.get("daynight", "D"),
                "satellite": item.get("satellite", "VIIRS"),
                "instrument": item.get("instrument", source),
                "classification": {
                    "category": cls,
                    "confidence": conf_num,
                    "risk_score": round(risk_score),
                },
                "category": cls,
                "risk_score": round(risk_score),
                "risk_level": risk_level,
                "risk_tier": risk_tier,
                "persistence_hours": persist_hrs,
                "persistence_hours_7d": persist_hrs,
                "facility_name": region_name,
                "region": region_name,
                "data_mode": data_mode,
                "firms": {
                    "brightness": round(float(bright), 2) if bright is not None else 330.0,
                    "frp": round(float(frp), 2) if frp is not None else 15.0,
                },
                "is_industrial": ind_ctx.get("is_industrial", False),
                "nearest_industrial_distance_m": ind_ctx.get("nearest_industrial_distance_m"),
                "relevant_tags": rel_tags,
                "matched_tags": rel_tags,
                "industrial_context": ind_ctx,
                "osm_context": osm_ctx,
                "copernicus_context": copernicus_ctx,
                "land_cover_type": cop_ctx.get("land_cover_type"),
                "ndvi_value": cop_ctx.get("ndvi_value"),
                "explanation": expl_text,
            },
        })

    return {
        "status": "success",
        "data_mode": data_mode,
        "count": len(fires),
        "source": source,
        "bbox": active_bbox,
        "day_range": day_range,
        "message": error_note or ("Live NASA FIRMS feed active" if data_mode == "live" else "Offline demo mode active"),
        "fires": fires,
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/firms/tile/{layer}/{z}/{x}/{y}.png")
async def get_firms_tile(
    layer: str,
    z: int,
    x: int,
    y: int,
):
    """Secure backend proxy for NASA FIRMS WMS thermal layers (e.g. fires_viirs_24, fires_modis_24).
    Keeps API key secure on server while providing standard raster tile stream to MapLibre.
    """
    settings = get_settings()
    key = settings.active_firms_key
    if not key:
        return Response(content=TRANSPARENT_1X1_PNG, media_type="image/png")

    cache_key = f"firms:tile:{layer}:{z}:{x}:{y}"
    cache = get_cache()
    cached_img = cache.get(cache_key)
    if cached_img:
        return Response(
            content=cached_img,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=900"},
        )

    bbox_str = _tile_to_epsg3857_bbox(z, x, y)
    wms_url = (
        f"https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/{key}/"
        f"?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png"
        f"&TRANSPARENT=TRUE&LAYERS={layer}&WIDTH=256&HEIGHT=256"
        f"&SRS=EPSG:3857&BBOX={bbox_str}"
    )

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(wms_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
                content = resp.content
                cache.set(cache_key, content, ttl_seconds=900)
                return Response(
                    content=content,
                    media_type="image/png",
                    headers={"Cache-Control": "public, max-age=900"},
                )
    except Exception as e:
        log.warning("WMS tile fetch error z=%s x=%s y=%s: %s", z, x, y, e)

    return Response(
        content=TRANSPARENT_1X1_PNG,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=120"},
    )

