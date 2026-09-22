from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import pagination
from app.core.config import get_settings
from app.db import models as m
from app.db.database import get_db

router = APIRouter(tags=["alerts"])


@router.get("/alerts")
def alerts(db: Session = Depends(get_db), pag: dict = Depends(pagination),
           risk: str | None = None, classification: str | None = None,
           status: str | None = None, since: datetime | None = None):
    s = get_settings()
    q = select(m.ThermalEvent).where((m.ThermalEvent.risk_score >= s.ALERT_RISK_THRESHOLD))
    if risk:
        q = q.where(m.ThermalEvent.risk_level == risk.upper())
    if classification:
        q = q.where(m.ThermalEvent.current_classification == classification)
    if status:
        q = q.where(m.ThermalEvent.status == status)
    if since:
        q = q.where(m.ThermalEvent.last_detected_at >= since)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = db.execute(q.order_by(m.ThermalEvent.risk_score.desc())
                      .offset(pag["offset"]).limit(pag["limit"])).scalars().all()
    return {"items": [{"id": e.id, "latitude": e.latitude, "longitude": e.longitude,
                       "classification": e.current_classification, "risk_score": e.risk_score,
                       "risk_level": e.risk_level, "status": e.status,
                       "last_detected_at": e.last_detected_at} for e in rows],
            "page": pag["page"], "limit": pag["limit"], "total": total,
            "threshold": s.ALERT_RISK_THRESHOLD}


from app.core.security import RoleAlert
from app.services import audit_service
from fastapi import HTTPException


@router.post("/alerts/{event_id}/dispatch")
def dispatch_alert(
    event_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(RoleAlert),
):
    ev = db.get(m.ThermalEvent, event_id)
    if not ev:
        raise HTTPException(404, f"Event {event_id} not found")
    prev_status = ev.status
    ev.status = "ALERTED"
    db.commit()
    db.refresh(ev)

    audit_service.log_incident_action(
        db,
        event_id=ev.id,
        action="ALERT_DISPATCH",
        from_status=prev_status,
        to_status="ALERTED",
        user_id=user["id"],
        user_role=user["role"],
        details={"dispatched_by": user["role"], "risk_score": ev.risk_score},
    )
    return {"id": ev.id, "status": ev.status, "message": "Simulated tactical alert dispatched to emergency response teams."}
