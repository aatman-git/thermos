"""Legacy compat for the existing frontend (api.js expects /api/anomalies + /api/stats)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models as m
from app.db.database import get_db
from app.services import analytics_service

router = APIRouter(tags=["legacy"])


@router.get("/anomalies")
def anomalies(db: Session = Depends(get_db), limit: int = 500):
    rows = db.execute(select(m.ThermalEvent).order_by(m.ThermalEvent.last_detected_at.desc())
                      .limit(min(limit, 1000))).scalars().all()
    feats = []
    for e in rows:
        f = e.feature_values or {}
        feats.append({"type": "Feature", "id": e.id,
                      "geometry": {"type": "Point", "coordinates": [e.longitude, e.latitude]},
                      "properties": {"anomaly_id": e.id, "classification": e.current_classification,
                                     "confidence": e.classification_confidence or 0,
                                     "risk_level": (e.risk_level or "MODERATE").upper(),
                                     "risk_score": e.risk_score,
                                     "acq_date": e.last_detected_at.date().isoformat() if e.last_detected_at else None,
                                     "acq_time": e.last_detected_at.strftime("%H%M") if e.last_detected_at else "0000",
                                     "persistence_hours_7d": e.persistence_hours,
                                     "facility_name": None, "brightness": f.get("brightness_k"),
                                     "frp": f.get("frp_mw")}})
    return {"type": "FeatureCollection", "features": feats}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    s = analytics_service.summary(db)
    return {"total": s["total_events"], "by_class": s["by_class"], "by_risk": s["by_risk"],
            "high_risk": s["high_risk_count"], "critical": s["critical_count"], "avg_frp": s["avg_frp_mw"]}
