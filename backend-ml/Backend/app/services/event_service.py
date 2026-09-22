"""Main prediction pipeline orchestrator: FIRMS obs -> event intelligence."""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import models as m
from app.ml.feature_schema import validate_feature_dict
from app.services import enrichment_service, risk_service, temporal_service
from app.services.explainability_service import explain_prediction
from app.services.firms_service import normalize_confidence, normalize_observation
from app.services.geo_service import find_candidate_event

log = get_logger("pipeline")
_pipeline_stats: dict[str, Any] = {"last_run": None, "records_processed": 0, "latencies_ms": {}}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def pipeline_stats() -> dict[str, Any]:
    return _pipeline_stats


def compute_data_quality(obs_norm: dict, temporal: dict, geo: dict) -> dict[str, Any]:
    score, warnings = 100.0, []
    if obs_norm.get("brightness_k") is None:
        score -= 15; warnings.append("Missing brightness_k")
    if obs_norm.get("frp_mw") is None:
        score -= 15; warnings.append("Missing frp_mw")
    if obs_norm.get("confidence_numeric") is None:
        score -= 10; warnings.append("Uncertain FIRMS confidence")
    if temporal.get("observation_count_7d", 0) < 2:
        score -= 10; warnings.append("Single observation; limited history")
    if geo.get("nearby_infrastructure", {}).get("source_status") == "unavailable":
        score -= 10; warnings.append("OSM enrichment unavailable")
    if geo.get("land_cover_source") == "demo-fallback":
        score -= 5; warnings.append("Land cover from demo fallback (not real raster)")
    if geo.get("population_source") == "demo-fallback":
        score -= 5; warnings.append("Population from demo fallback (not WorldPop)")
    return {"score": round(max(score, 0), 1), "warnings": warnings}


def _event_to_context(ev: m.ThermalEvent, db: Session) -> dict[str, Any]:
    obs = db.execute(select(m.ThermalObservation).where(m.ThermalObservation.event_id == ev.id)
                     .order_by(m.ThermalObservation.acquired_at.desc()).limit(20)).scalars().all()
    pred = db.execute(select(m.Prediction).where(m.Prediction.event_id == ev.id)
                      .order_by(m.Prediction.created_at.desc()).limit(1)).scalars().first()
    risk = db.execute(select(m.RiskAssessment).where(m.RiskAssessment.event_id == ev.id)
                      .order_by(m.RiskAssessment.created_at.desc()).limit(1)).scalars().first()
    probs = (pred.probabilities if pred else {}) or {}
    return {
        "id": ev.id,
        "classification": {"label": ev.current_classification,
                           "confidence": round(ev.classification_confidence, 4) if ev.classification_confidence else None,
                           "probabilities": probs},
        "risk": {"score": ev.risk_score, "level": ev.risk_level,
                 "factors": (risk.factors if risk else {})},
        "temporal": ev.temporal_context or {},
        "geospatial": ev.geospatial_context or {},
        "feature_values": ev.feature_values or {},
        "observations": [{"acquired_at": o.acquired_at.isoformat(), "frp_mw": o.frp_mw,
                          "brightness_k": o.brightness_k} for o in obs],
        "explainability": (pred.explanations if pred else {}) or {},
        "meta": {"data_mode": ev.data_mode, "model_version": ev.model_version},
    }


def get_event_context(event_id: str, db: Session) -> dict[str, Any] | None:
    ev = db.get(m.ThermalEvent, event_id)
    return _event_to_context(ev, db) if ev else None


def process_event(raw_obs: dict[str, Any], db: Session, data_mode: str = "demo") -> dict[str, Any]:
    """15-step pipeline. Reusable from API, workers, demo mode, tests."""
    t0 = time.perf_counter()
    s = get_settings()
    # 1-2. normalize
    obs = normalize_observation(raw_obs, default_source=raw_obs.get("source", "VIIRS"))
    if obs is None:
        raise ValueError("Invalid observation: coordinates out of bounds or malformed payload rejected by security filter")
    lat, lon, acq = obs["latitude"], obs["longitude"], obs["acquired_at"]
    # 3. candidate search (recent events, cheap prefilter)
    recent = db.execute(select(m.ThermalEvent).order_by(m.ThermalEvent.last_detected_at.desc()).limit(500)).scalars().all()
    match = find_candidate_event(lat, lon, acq, recent, s.EVENT_CLUSTER_RADIUS_KM, s.EVENT_CLUSTER_TIME_HOURS)
    # 4. create or update event
    is_new = match is None
    if is_new:
        prefix = {"Industrial": "IND", "Agricultur": "AGR", "Wild": "WLD", "Gas": "FLR", "Mining": "MIN"}.get("x", "EVT")
        ev = m.ThermalEvent(id=f"EVT-{uuid.uuid4().hex[:6].upper()}", latitude=lat, longitude=lon,
                            geom_wkt=f"POINT({lon} {lat})", first_detected_at=acq, last_detected_at=acq,
                            observation_count=1, persistence_hours=0.0, data_mode=data_mode, status="DETECTED")
        db.add(ev)
        db.flush()
    else:
        ev = match
        ev.last_detected_at = max(_aware(ev.last_detected_at), _aware(acq))
        ev.latitude, ev.longitude = lat, lon
        ev.observation_count = (ev.observation_count or 0) + 1
    # store observation
    o = m.ThermalObservation(event_id=ev.id, source=obs["source"], latitude=lat, longitude=lon,
                             geom_wkt=f"POINT({lon} {lat})", acquired_at=acq, brightness_k=obs["brightness_k"],
                             frp_mw=obs["frp_mw"], confidence=obs["confidence"],
                             confidence_raw=str(obs["confidence_raw"]), confidence_numeric=obs["confidence_numeric"],
                             daynight=obs["daynight"], satellite=obs["satellite"], instrument=obs["instrument"],
                             scan_km=obs["scan_km"], track_km=obs["track_km"], raw_payload=obs["raw_payload"])
    db.add(o)
    db.flush()
    # 5. history
    hist = db.execute(select(m.ThermalObservation).where(m.ThermalObservation.event_id == ev.id)
                      .order_by(m.ThermalObservation.acquired_at)).scalars().all()
    hist_dicts = [{"acquired_at": h.acquired_at, "frp_mw": h.frp_mw} for h in hist]
    # 6. temporal features
    temporal = temporal_service.compute_temporal_features(hist_dicts, now=acq)
    ev.persistence_hours = temporal["persistence_hours_7d"]
    # 7. geospatial enrichment (graceful)
    t_geo = time.perf_counter()
    try:
        geo = enrichment_service.enrich_location(lat, lon)
    except Exception as e:  # noqa: BLE001
        log.warning("enrichment failed: %s", e)
        geo = {"source_status": "unavailable", "industrial_proximity_km": 25.0,
               "refinery_proximity_km": 40.0, "mine_proximity_km": 50.0, "forest_proximity_km": 20.0,
               "cropland_proximity_km": 15.0, "population_5km": 5000, "land_cover": "Grassland",
               "enrichment_sources": {"osm": "unavailable"}}
    geo_ms = (time.perf_counter() - t_geo) * 1000
    # 8-9. feature vector + validation
    conf_pct = obs["confidence_numeric"] if obs["confidence_numeric"] is not None else 60.0
    features = {
        "brightness_k": obs["brightness_k"] if obs["brightness_k"] is not None else 320.0,
        "frp_mw": obs["frp_mw"] if obs["frp_mw"] is not None else 10.0,
        "firms_confidence_pct": float(conf_pct),
        "daynight": 1 if obs["daynight"] == "D" else 0,
        "observation_count_7d": temporal["observation_count_7d"],
        "persistence_hours_7d": temporal["persistence_hours_7d"],
        "frp_trend_pct": temporal["frp_trend_pct"] if temporal["frp_trend_pct"] is not None else 0.0,
        "industrial_proximity_km": geo["industrial_proximity_km"],
        "refinery_proximity_km": geo["refinery_proximity_km"],
        "mine_proximity_km": geo["mine_proximity_km"],
        "forest_proximity_km": geo["forest_proximity_km"],
        "cropland_proximity_km": geo["cropland_proximity_km"],
        "population_5km": geo["population_5km"],
        "land_cover": geo["land_cover"],
    }
    quality = validate_feature_dict(features)
    # 10. ML prediction
    t_ml = time.perf_counter()
    from app.ml.predictor import predict_features
    pred = predict_features(features)
    ml_ms = (time.perf_counter() - t_ml) * 1000
    # 11. explainability
    explanation = explain_prediction(features, pred["predicted_class"], pred["probabilities"])
    # 12. risk
    risk = risk_service.calculate_risk(features, temporal)
    # data quality
    dq = compute_data_quality(obs, temporal, geo)
    # 13-14. store
    ev.current_classification = pred["predicted_class"]
    ev.classification_confidence = pred["confidence"]
    ev.risk_score = risk["risk_score"]
    ev.risk_level = risk["risk_level"]
    ev.data_quality_score = dq["score"]
    if ev.status in (None, "DETECTED", "CLASSIFIED", "active"):
        ev.status = "ALERTED" if risk["risk_score"] >= s.ALERT_RISK_THRESHOLD else "ASSESSED"
    ev.feature_values = features
    ev.geospatial_context = {k: geo.get(k) for k in (
        "industrial_proximity_km", "refinery_proximity_km", "mine_proximity_km",
        "forest_proximity_km", "cropland_proximity_km", "population_5km",
        "population_source", "land_cover", "land_cover_source", "nearby_infrastructure")}
    ev.temporal_context = temporal
    ev.model_version = pred["model_version"]
    ev.enrichment_sources = geo.get("enrichment_sources", {})
    ev.updated_at = datetime.now(timezone.utc)
    db.add(m.Prediction(event_id=ev.id, model_version=pred["model_version"],
                        predicted_class=pred["predicted_class"], confidence=pred["confidence"],
                        probabilities=pred["probabilities"], explanations=explanation,
                        low_margin=pred["low_margin"], needs_review=pred["needs_review"]))
    db.add(m.RiskAssessment(event_id=ev.id, risk_engine_version=risk["risk_engine_version"],
                            risk_score=risk["risk_score"], risk_level=risk["risk_level"], factors=risk["factors"]))
    db.commit()
    db.refresh(ev)
    total_ms = (time.perf_counter() - t0) * 1000
    _pipeline_stats.update({"last_run": datetime.now(timezone.utc).isoformat(),
                            "records_processed": _pipeline_stats["records_processed"] + 1,
                            "latencies_ms": {"total": round(total_ms, 1), "geo_ms": round(geo_ms, 1),
                                             "ml_ms": round(ml_ms, 1)}})
    log.info("processed event=%s class=%s risk=%s (%.0fms)", ev.id, pred["predicted_class"], risk["risk_level"], total_ms)
    # 15. response
    return {
        "event": {"id": ev.id, "latitude": ev.latitude, "longitude": ev.longitude},
        "classification": {"label": pred["predicted_class"], "confidence": round(pred["confidence"], 4),
                           "probabilities": {k: round(v, 4) for k, v in pred["probabilities"].items()},
                           "low_margin": pred["low_margin"], "needs_review": pred["needs_review"]},
        "risk": {"score": risk["risk_score"], "level": risk["risk_level"], "factors": risk["factors"],
                 "disclaimer": risk["disclaimer"]},
        "temporal": temporal,
        "geospatial": ev.geospatial_context,
        "explainability": explanation,
        "data_quality": dq,
        "meta": {"model_version": pred["model_version"], "data_mode": data_mode,
                 "feature_schema_version": "v1", "risk_engine_version": risk["risk_engine_version"],
                 "processing_ms": round(total_ms, 1)},
    }
