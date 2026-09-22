from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.schemas.events import FirmsObservationIn
from app.schemas.predictions import PredictFeaturesIn, PredictOut
from app.core.rate_limit import rate_limit
from app.core.security import RoleClassify
from app.services import event_service

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictOut, dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))])
def predict(obs: FirmsObservationIn, db: Session = Depends(get_db), user: dict = Depends(RoleClassify)):
    """Primary workflow: FIRMS-style observation -> full intelligence (enrichment automatic)."""
    s = get_settings()
    data_mode = "live" if (s.ENABLE_LIVE_FIRMS and s.active_firms_key) else "demo"
    try:
        full = event_service.process_event(obs.model_dump(), db, data_mode=data_mode)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return PredictOut(predicted_class=full["classification"]["label"],
                      confidence=full["classification"]["confidence"],
                      probabilities=full["classification"]["probabilities"],
                      model_version=full["meta"]["model_version"],
                      feature_values=(full.get("geospatial") or {}) | {"frp": None},
                      feature_quality={"warnings": full["data_quality"]["warnings"]},
                      low_margin=full["classification"]["low_margin"],
                      needs_review=full["classification"]["needs_review"],
                      explanations=full["explainability"])


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
