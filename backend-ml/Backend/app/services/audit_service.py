"""Append-only immutable audit trail service for IncidentLog entries."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models as m


def log_incident_action(
    db: Session,
    event_id: str,
    action: str,
    from_status: str | None = None,
    to_status: str | None = None,
    user_id: str | None = None,
    user_role: str | None = None,
    details: dict[str, Any] | None = None,
) -> m.IncidentLog:
    """Create an append-only audit trail entry. Rows are never modified or deleted."""
    log_entry = m.IncidentLog(
        event_id=event_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        user_id=user_id or "system",
        user_role=user_role or "System",
        details=details or {},
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def get_incident_timeline(db: Session, event_id: str) -> list[dict[str, Any]]:
    """Retrieve chronologically ordered immutable audit timeline for an incident."""
    rows = db.execute(
        select(m.IncidentLog)
        .where(m.IncidentLog.event_id == event_id)
        .order_by(m.IncidentLog.created_at.asc())
    ).scalars().all()

    return [
        {
            "id": r.id,
            "event_id": r.event_id,
            "action": r.action,
            "from_status": r.from_status,
            "to_status": r.to_status,
            "user_id": r.user_id,
            "user_role": r.user_role,
            "details": r.details or {},
            "timestamp": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
