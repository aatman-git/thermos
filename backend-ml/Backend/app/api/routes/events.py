from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import pagination
from app.core.config import get_settings
from app.db import models as m
from app.db.database import get_db
from app.schemas.events import EventDetail, FirmsObservationIn, StatusUpdate
from app.services import event_service

router = APIRouter(tags=["events"])


def _map_item(ev: m.ThermalEvent) -> dict[str, Any]:
    conf = ev.classification_confidence
    return {"id": ev.id, "latitude": ev.latitude, "longitude": ev.longitude,
            "classification": ev.current_classification,
            "confidence": round(conf * 100, 1) if conf is not None and conf <= 1 else conf,
            "risk_score": ev.risk_score, "risk_level": ev.risk_level,
            "persistence_hours": ev.persistence_hours,
            "frp_mw": (ev.feature_values or {}).get("frp_mw") if ev.feature_values else None,
            "status": ev.status, "data_mode": ev.data_mode}


@router.get("/events")
def list_events(db: Session = Depends(get_db), pag: dict = Depends(pagination),
                bbox: str | None = None, lat: float | None = None, lon: float | None = None,
                radius_km: float | None = Query(None, gt=0, le=2000),
                classification: str | None = None, risk_level: str | None = None,
                min_confidence: float | None = None, start_time: datetime | None = None,
                end_time: datetime | None = None, status: str | None = None):
    q = select(m.ThermalEvent)
    if classification:
        q = q.where(m.ThermalEvent.current_classification == classification)
    if risk_level:
        q = q.where(m.ThermalEvent.risk_level == risk_level.upper())
    if status:
        q = q.where(m.ThermalEvent.status == status)
    if min_confidence is not None:
        q = q.where(m.ThermalEvent.classification_confidence >= min_confidence / 100.0
                    if min_confidence > 1 else m.ThermalEvent.classification_confidence >= min_confidence)
    if start_time:
        q = q.where(m.ThermalEvent.last_detected_at >= start_time)
    if end_time:
        q = q.where(m.ThermalEvent.last_detected_at <= end_time)
    if bbox:
        try:
            lo, la, hi, ha = [float(x) for x in bbox.split(",")]
            q = q.where(m.ThermalEvent.longitude >= lo, m.ThermalEvent.longitude <= hi,
                        m.ThermalEvent.latitude >= la, m.ThermalEvent.latitude <= ha)
        except ValueError:
            raise HTTPException(400, "bbox must be minlon,minlat,maxlon,maxlat")
    elif lat is not None and lon is not None and radius_km:
        import math
        d_lat = radius_km / 110.574
        cos_lat = max(math.cos(math.radians(lat)), 0.01)
        d_lon = radius_km / (111.320 * cos_lat)
        q = q.where(m.ThermalEvent.latitude >= lat - d_lat,
                    m.ThermalEvent.latitude <= lat + d_lat,
                    m.ThermalEvent.longitude >= lon - d_lon,
                    m.ThermalEvent.longitude <= lon + d_lon)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.execute(q.order_by(m.ThermalEvent.last_detected_at.desc())
                      .offset(pag["offset"]).limit(pag["limit"])).scalars().all()
    items = [_map_item(e) for e in rows]
    if lat is not None and lon is not None and radius_km:
        from app.services.geo_service import haversine_km
        items = [i for i in items if haversine_km(lat, lon, i["latitude"], i["longitude"]) <= radius_km]
    return {"items": items, "page": pag["page"], "limit": pag["limit"], "total": total}


@router.get("/events/{event_id}")
def event_detail(event_id: str, db: Session = Depends(get_db)):
    ev = db.get(m.ThermalEvent, event_id)
    if not ev:
        raise HTTPException(404, f"Event {event_id} not found")
    ctx = event_service.get_event_context(event_id, db)
    assert ctx
    g, t = ctx["geospatial"], ctx["temporal"]
    return {"id": ev.id, "latitude": ev.latitude, "longitude": ev.longitude,
            "classification": ev.current_classification, "confidence": ev.classification_confidence,
            "probabilities": ctx["classification"]["probabilities"],
            "risk_score": ev.risk_score, "risk_level": ev.risk_level,
            "risk_factors": ctx["risk"]["factors"], "risk_disclaimer": "Operational priority score, not disaster probability.",
            "temporal": t, "observations": ctx["observations"], "geospatial": g,
            "population": {"population_5km": g.get("population_5km"),
                           "source": g.get("population_source")},
            "land_cover": g.get("land_cover"), "explainability": ctx["explainability"],
            "data_quality": {"score": ev.data_quality_score},
            "data_mode": ev.data_mode, "status": ev.status, "model_version": ev.model_version,
            "enrichment_sources": ev.enrichment_sources,
            "first_detected_at": ev.first_detected_at, "last_detected_at": ev.last_detected_at,
            "created_at": ev.created_at, "updated_at": ev.updated_at}


from app.core.security import RoleClassify, RoleStatusChange
from app.services import audit_service
from app.services.state_machine import validate_transition


@router.post("/events/process")
def process_event(obs: FirmsObservationIn, db: Session = Depends(get_db), user: dict = Depends(RoleClassify)):
    s = get_settings()
    data_mode = "live" if (s.ENABLE_LIVE_FIRMS and s.FIRMS_MAP_KEY) else "demo"
    try:
        res = event_service.process_event(obs.model_dump(), db, data_mode=data_mode)
        eid = res["event"]["id"]
        audit_service.log_incident_action(
            db,
            event_id=eid,
            action="CLASSIFICATION",
            to_status=res.get("classification", {}).get("label"),
            user_id=user["id"],
            user_role=user["role"],
            details={"classification": res["classification"], "risk": res["risk"]},
        )
        return res
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/events/{event_id}/status")
@router.patch("/incidents/{event_id}/status")
def update_status(
    event_id: str,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(RoleStatusChange),
):
    ev = db.get(m.ThermalEvent, event_id)
    if not ev:
        raise HTTPException(404, f"Event {event_id} not found")
    curr = ev.status or "DETECTED"
    try:
        new_status = validate_transition(curr, body.status)
    except ValueError as err:
        raise HTTPException(status_code=409, detail=str(err))
    ev.status = new_status
    db.commit()
    db.refresh(ev)

    # Immutable audit logging
    audit_service.log_incident_action(
        db,
        event_id=ev.id,
        action="STATUS_CHANGE",
        from_status=curr,
        to_status=new_status,
        user_id=user["id"],
        user_role=user["role"],
        details={"reason": getattr(body, "reason", None)},
    )

    return {"id": ev.id, "previous_status": curr, "status": ev.status}


@router.get("/events/{event_id}/timeline")
@router.get("/incidents/{event_id}/timeline")
def incident_timeline(event_id: str, db: Session = Depends(get_db)):
    ev = db.get(m.ThermalEvent, event_id)
    if not ev:
        raise HTTPException(404, f"Event {event_id} not found")
    timeline = audit_service.get_incident_timeline(db, event_id)
    return {"event_id": event_id, "timeline": timeline, "count": len(timeline)}
