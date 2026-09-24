from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.schemas.events import FirmsObservationIn
from app.schemas.predictions import PredictFeaturesIn, PredictOut
from app.core.logging import get_logger
from app.core.rate_limit import rate_limit
from app.core.security import get_current_user
from app.db import models as m
from app.services import enrichment_service, event_service, risk_service
from app.services.copernicus_service import get_copernicus_context
from app.services.ai_explainer_service import generate_fire_explanation
from app.services.explainability_service import explain_prediction
from app.services.geo_service import haversine_km
from app.services.osm_service import get_industrial_context
from sqlalchemy import select

log = get_logger("routes.prediction")
router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictOut, dependencies=[Depends(rate_limit(max_requests=120, window_seconds=60))])
def predict(obs: FirmsObservationIn, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Location-based ML prediction pipeline:
    Step 1: Location received (lat, lon) & thermal parameters checked
    Step 2: Features gathered (OSM industrial context, Copernicus land cover/NDVI, proximities, population)
    Step 3: Existing ML model called (XGBoost 14-feature classifier)
    Step 4: Structured prediction returned with risk score & Gemini AI explanation
    """
    settings = get_settings()
    lat, lon = obs.latitude, obs.longitude

    # -------------------------------------------------------------
    # Step 1: Location received
    # -------------------------------------------------------------
    has_explicit_thermal = obs.brightness_k is not None or obs.frp_mw is not None
    log.info(
        "PREDICT [Step 1/4] Location received: lat=%.5f, lon=%.5f (explicit_thermal=%s, brightness=%s, frp=%s)",
        lat, lon, has_explicit_thermal, obs.brightness_k, obs.frp_mw,
    )

    try:
        # Check if an active satellite detection is already near this point
        nearby_hotspot = None
        if not has_explicit_thermal:
            try:
                # 1a. Check in-memory / live FIRMS cache
                from app.services.firms import get_firms_service
                firms_feed = get_firms_service().fetch_cached()
                for f in firms_feed.get("fires", []):
                    flat, flon = f.get("latitude"), f.get("longitude")
                    if flat is not None and flon is not None and haversine_km(lat, lon, float(flat), float(flon)) <= 15.0:
                        nearby_hotspot = f
                        break
            except Exception as e:
                log.debug("FIRMS live cache lookup note: %s", e)

            # 1b. Check database ThermalObservation
            if nearby_hotspot is None:
                try:
                    recent = db.execute(select(m.ThermalObservation).order_by(m.ThermalObservation.acquired_at.desc()).limit(200)).scalars().all()
                    for o in recent:
                        if haversine_km(lat, lon, o.latitude, o.longitude) <= 15.0:
                            nearby_hotspot = {
                                "brightness_k": o.brightness_k,
                                "frp_mw": o.frp_mw,
                                "confidence_numeric": o.confidence_numeric or 70.0,
                                "daynight": o.daynight or "D",
                            }
                            break
                except Exception as e:
                    log.debug("DB thermal lookup note: %s", e)

        # -------------------------------------------------------------
        # Step 2: Features gathered (OSM, Copernicus, Proximities, Land Cover)
        # -------------------------------------------------------------
        industrial_ctx = get_industrial_context(lat, lon, radius_m=1000)
        copernicus_ctx = get_copernicus_context(lat, lon)
        rel_tags = industrial_ctx.get("relevant_tags") or industrial_ctx.get("matched_tags", {})
        osm_ctx = {
            "is_industrial": industrial_ctx.get("is_industrial", False),
            "nearest_industrial_distance_m": industrial_ctx.get("nearest_industrial_distance_m"),
            "relevant_tags": rel_tags,
            "matched_tags": rel_tags,
        }
        cop_ctx_obj = {
            "land_cover_type": copernicus_ctx.get("land_cover_type"),
            "ndvi_value": copernicus_ctx.get("ndvi_value"),
        }

        # Derive regional proximities and baseline land cover
        try:
            geo = enrichment_service.enrich_location(lat, lon)
        except Exception as e:
            log.warning("Enrichment service error, using fallback: %s", e)
            geo = {
                "industrial_proximity_km": 30.0,
                "refinery_proximity_km": 40.0,
                "mine_proximity_km": 50.0,
                "forest_proximity_km": 20.0,
                "cropland_proximity_km": 15.0,
                "population_5km": 3500,
                "land_cover": "Cropland",
            }

        # Resolve land cover & proximity priority: OSM > Copernicus > Regional
        land_cover = geo.get("land_cover", "Cropland")
        ind_prox = float(geo.get("industrial_proximity_km", 25.0))
        ref_prox = float(geo.get("refinery_proximity_km", 35.0))
        mine_prox = float(geo.get("mine_proximity_km", 45.0))
        for_prox = float(geo.get("forest_proximity_km", 20.0))
        crop_prox = float(geo.get("cropland_proximity_km", 15.0))
        population_5km = int(geo.get("population_5km", 3000))

        if industrial_ctx.get("is_industrial"):
            land_cover = "Industrial"
            nearest_m = industrial_ctx.get("nearest_industrial_distance_m") or 250.0
            ind_prox = min(ind_prox, nearest_m / 1000.0)
            ref_prox = min(ref_prox, ind_prox * 1.5 if ind_prox > 0 else 0.8)
            for_prox = max(for_prox, 20.0)  # Active industrial zones are not wildfire zones
            mine_prox = max(mine_prox, 25.0)
            population_5km = max(population_5km, 8500)
        elif copernicus_ctx.get("land_cover_type"):
            clc = str(copernicus_ctx["land_cover_type"]).lower()
            if "forest" in clc:
                land_cover = "Forest"
                for_prox = min(for_prox, 0.5)
                ind_prox = max(ind_prox, 25.0)
                ref_prox = max(ref_prox, 40.0)
                population_5km = min(population_5km, 1200)
            elif "built" in clc:
                land_cover = "Built-up"
                ind_prox = min(ind_prox, 3.0)
            elif "crop" in clc:
                land_cover = "Cropland"
                crop_prox = min(crop_prox, 0.5)
            elif "grass" in clc:
                land_cover = "Grassland"
        elif land_cover == "Forest":
            for_prox = min(for_prox, 0.5)
            ind_prox = max(ind_prox, 25.0)
            ref_prox = max(ref_prox, 40.0)
            population_5km = min(population_5km, 1200)

        # Determine thermal features: from explicit input, nearby hotspot, or typical profile
        if has_explicit_thermal:
            brightness_k = float(obs.brightness_k if obs.brightness_k is not None else 335.0)
            frp_mw = float(obs.frp_mw if obs.frp_mw is not None else 20.0)
            conf_pct = float(obs.confidence if obs.confidence is not None else 75.0)
            dn_val = 1 if (obs.daynight or "D").upper().startswith("D") else 0
            obs_count = 3
            persistence_hrs = 8.0
            has_active_hotspot = True
        elif nearby_hotspot is not None:
            brightness_k = float(nearby_hotspot.get("brightness_k") or nearby_hotspot.get("brightness") or 340.0)
            frp_mw = float(nearby_hotspot.get("frp_mw") or nearby_hotspot.get("frp") or 25.0)
            conf_pct = float(nearby_hotspot.get("confidence_numeric") or nearby_hotspot.get("confidence") or 75.0)
            dn_raw = str(nearby_hotspot.get("daynight") or "D").upper()
            dn_val = 1 if dn_raw.startswith("D") else 0
            obs_count = int(nearby_hotspot.get("observation_count_7d") or 3)
            persistence_hrs = float(nearby_hotspot.get("persistence_hours_7d") or 8.0)
            has_active_hotspot = True
        else:
            # Baseline simulation for coordinate location
            has_active_hotspot = False
            dn_val = 1 if (obs.daynight or "D").upper().startswith("D") else 0
            conf_pct = 75.0
            if land_cover == "Industrial":
                brightness_k = 346.0
                frp_mw = 35.0
                obs_count = 4
                persistence_hrs = 12.0
            elif land_cover == "Forest":
                brightness_k = 338.0
                frp_mw = 25.0
                obs_count = 2
                persistence_hrs = 6.0
            elif land_cover == "Mining":
                brightness_k = 335.0
                frp_mw = 20.0
                obs_count = 2
                persistence_hrs = 6.0
            else:
                brightness_k = 332.0
                frp_mw = 18.0
                obs_count = 2
                persistence_hrs = 4.0

        features = {
            "brightness_k": round(brightness_k, 2),
            "frp_mw": round(frp_mw, 2),
            "firms_confidence_pct": round(conf_pct, 1),
            "daynight": dn_val,
            "observation_count_7d": obs_count,
            "persistence_hours_7d": persistence_hrs,
            "frp_trend_pct": 0.0,
            "industrial_proximity_km": round(ind_prox, 2),
            "refinery_proximity_km": round(ref_prox, 2),
            "mine_proximity_km": round(mine_prox, 2),
            "forest_proximity_km": round(for_prox, 2),
            "cropland_proximity_km": round(crop_prox, 2),
            "population_5km": population_5km,
            "land_cover": land_cover,
        }

        log.info(
            "PREDICT [Step 2/4] Features gathered: land_cover='%s', ind_prox=%.2f km, ref_prox=%.2f km, "
            "for_prox=%.2f km, crop_prox=%.2f km, pop=%d, thermal=(brightness=%.1f K, frp=%.1f MW)",
            land_cover, ind_prox, ref_prox, for_prox, crop_prox, population_5km, brightness_k, frp_mw,
        )

        # -------------------------------------------------------------
        # Step 3: Call ML Model (XGBoost Classifier)
        # -------------------------------------------------------------
        from app.ml.predictor import predict_features
        log.info("PREDICT [Step 3/4] Calling ML model (%s) with 14 features", settings.MODEL_VERSION)
        pred = predict_features(features)
        risk = risk_service.calculate_risk(features)
        expl = explain_prediction(features, pred["predicted_class"], pred["probabilities"])

        predicted_class = pred["predicted_class"]
        confidence_val = round(float(pred["confidence"]), 3)
        raw_risk_score = float(risk["risk_score"])

        # Operational risk score calibration
        if not has_active_hotspot:
            risk_score = round(min(raw_risk_score * 0.25, 20.0), 1)
            risk_level = "LOW"
        else:
            if predicted_class == "Industrial Fire":
                risk_score = min(98.0, max(raw_risk_score + 35.0, 72.0))
            elif predicted_class == "Wildfire":
                risk_score = min(95.0, max(raw_risk_score + 25.0, 64.0))
            elif predicted_class == "Gas Flare":
                risk_score = min(85.0, max(raw_risk_score + 20.0, 52.0))
            elif predicted_class in ("Mining Activity", "Industrial Thermal Source"):
                risk_score = min(80.0, max(raw_risk_score + 15.0, 48.0))
            else:
                risk_score = raw_risk_score
            risk_level = "CRITICAL" if risk_score >= 80.0 else ("HIGH" if risk_score >= 60.0 else ("MODERATE" if risk_score >= 35.0 else "LOW"))

        # Generate Gemini AI explanation
        expl_text = generate_fire_explanation({
            "category": predicted_class,
            "confidence": confidence_val,
            "risk_score": round(risk_score, 1),
            "firms": {"brightness": brightness_k, "frp": frp_mw},
            "osm": osm_ctx,
            "copernicus": cop_ctx_obj,
        })

        # -------------------------------------------------------------
        # Step 4: Return Prediction
        # -------------------------------------------------------------
        log.info(
            "PREDICT [Step 4/4] Prediction returned: class='%s', confidence=%.3f, risk_score=%.1f (%s)",
            predicted_class, confidence_val, risk_score, risk_level,
        )

        ind_label = f" (Within industrial zone: {rel_tags.get('name', 'Industrial Area')})" if industrial_ctx.get("is_industrial") else ""
        msg = f"Location classified as {predicted_class} with {confidence_val * 100:.1f}% confidence. Operational risk is {risk_level} (Score: {risk_score:.1f}).{ind_label}"

        return PredictOut(
            predicted_class=predicted_class,
            display_class=predicted_class,
            confidence=confidence_val,
            probabilities=pred["probabilities"],
            model_version=pred["model_version"],
            feature_values=features,
            feature_quality=pred["feature_quality"],
            low_margin=pred["low_margin"],
            needs_review=pred["needs_review"],
            explanations=expl,
            risk_score=round(risk_score, 1),
            risk_level=risk_level,
            has_hotspot=has_active_hotspot,
            location={"latitude": lat, "longitude": lon},
            message=msg,
            is_industrial=industrial_ctx["is_industrial"],
            nearest_industrial_distance_m=industrial_ctx["nearest_industrial_distance_m"],
            relevant_tags=rel_tags,
            matched_tags=rel_tags,
            industrial_context=industrial_ctx,
            osm_context=osm_ctx,
            copernicus_context=cop_ctx_obj,
            land_cover_type=copernicus_ctx.get("land_cover_type"),
            ndvi_value=copernicus_ctx.get("ndvi_value"),
            explanation=expl_text,
            classification={
                "category": predicted_class,
                "confidence": confidence_val,
                "risk_score": round(risk_score, 1),
            },
            firms={
                "brightness": brightness_k,
                "frp": frp_mw,
            },
        )
    except Exception as exc:
        log.error("PREDICT [ERROR] Failed during prediction pipeline for (%.5f, %.5f): %s", lat, lon, exc, exc_info=True)
        raise HTTPException(500, f"Location prediction failed: {exc}")


@router.post("/dev/predict-features", response_model=PredictOut)
def dev_predict_features(body: PredictFeaturesIn):
    """Developer-only: direct 14-feature inference. Disabled in production."""
    s = get_settings()
    if s.is_production:
        raise HTTPException(403, "Developer endpoint disabled in production")
    from app.ml.predictor import predict_features
    try:
        p = predict_features(body.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))
    from app.services.explainability_service import explain_prediction
    expl = explain_prediction(body.model_dump(), p["predicted_class"], p["probabilities"])
    return PredictOut(predicted_class=p["predicted_class"], confidence=p["confidence"],
                      probabilities=p["probabilities"], model_version=p["model_version"],
                      feature_values=p["feature_values"], feature_quality=p["feature_quality"],
                      low_margin=p["low_margin"], needs_review=p["needs_review"], explanations=expl)
