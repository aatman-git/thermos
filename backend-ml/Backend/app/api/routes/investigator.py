from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models as m
from app.db.database import get_db
from app.schemas.investigator import EventAskIn, InvestigatorAskIn, InvestigatorAskOut
from app.services import event_service, investigator_service

router = APIRouter(tags=["investigator"])


from starlette.concurrency import run_in_threadpool
from app.core.rate_limit import rate_limit


async def _handle_ask(event_id: str | None, question: str, extra_context: dict[str, Any] | None, db: Session) -> InvestigatorAskOut:
    ctx = await run_in_threadpool(lambda: event_service.get_event_context(event_id, db) if event_id else None)
    if not ctx and event_id:
        from app.services.firms_service import FirmsService
        fallback_fires = FirmsService().get_fallback_events(limit=50)
        matched = next((f for f in fallback_fires if f.get("id") == event_id), None)
        extra = extra_context or {}
        if matched:
            cls_name = matched.get("classification") or extra.get("category") or "Thermal Event"
            ctx = {
                "id": event_id,
                "classification": {
                    "label": cls_name,
                    "confidence": (matched.get("confidence_numeric") or 80.0) / 100.0,
                },
                "risk": {
                    "score": matched.get("risk_score", 75),
                    "level": matched.get("risk_level", "HIGH"),
                },
                "temporal": {
                    "observation_count_7d": 4,
                    "persistence_hours_7d": 48.0,
                    "frp_trend_pct": 5.0,
                },
                "geospatial": {
                    "industrial_proximity_km": 0.2 if "Industrial" in str(cls_name) else 15.0,
                    "forest_proximity_km": 0.5 if "Wildfire" in str(cls_name) else 20.0,
                    "cropland_proximity_km": 0.5 if "Agricultural" in str(cls_name) else 15.0,
                    "population_5km": 8500,
                    "land_cover": "Industrial" if "Industrial" in str(cls_name) else ("Forest" if "Wildfire" in str(cls_name) else "Cropland"),
                },
                "meta": {"data_mode": "demo"},
            }
        else:
            cls_name = extra.get("category") or extra.get("classification") or "Thermal Event"
            conf = extra.get("confidence", 85)
            try:
                conf_val = float(conf) / 100.0 if float(conf) > 1 else float(conf)
            except (ValueError, TypeError):
                conf_val = 0.85
            ctx = {
                "id": event_id,
                "classification": {
                    "label": cls_name,
                    "confidence": conf_val,
                },
                "risk": {
                    "score": extra.get("risk_score", 70),
                    "level": extra.get("risk_tier") or extra.get("risk_level", "MODERATE"),
                },
                "temporal": {
                    "observation_count_7d": extra.get("observation_count", 3),
                    "persistence_hours_7d": extra.get("persistence_hours", 24.0),
                },
                "geospatial": {
                    "land_cover": extra.get("land_cover") or extra.get("land_cover_type") or "Regional",
                    "region": extra.get("region"),
                },
                "meta": {"data_mode": "demo"},
            }

    res = await investigator_service.ask_investigator(question, ctx)
    if event_id and ctx:
        def _save_session():
            try:
                db.add(m.InvestigationSession(event_id=event_id, question=question,
                                              answer=res["answer"], evidence=res["evidence"],
                                              provider=res["provider"]))
                db.commit()
            except Exception:
                pass
        await run_in_threadpool(_save_session)
    return InvestigatorAskOut(answer=res["answer"], evidence=res["evidence"],
                              provider=res["provider"], event_id=event_id)


@router.post("/investigator/ask", response_model=InvestigatorAskOut, dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))])
async def ask(body: InvestigatorAskIn, db: Session = Depends(get_db)):
    return await _handle_ask(body.event_id, body.question, getattr(body, "context", None), db)


@router.post("/events/{event_id}/ask", response_model=InvestigatorAskOut, dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))])
@router.post("/incidents/{event_id}/ask", response_model=InvestigatorAskOut, dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))])
async def ask_by_event_id(event_id: str, body: EventAskIn, db: Session = Depends(get_db)):
    return await _handle_ask(event_id or body.event_id, body.question, body.context, db)


@router.get("/investigator/sessions")
def sessions(event_id: str | None = None, limit: int = 20, db: Session = Depends(get_db)):
    q = select(m.InvestigationSession).order_by(m.InvestigationSession.created_at.desc()).limit(min(limit, 100))
    if event_id:
        q = q.where(m.InvestigationSession.event_id == event_id)
    rows = db.execute(q).scalars().all()
    return {"items": [{"id": r.id, "event_id": r.event_id, "question": r.question,
                       "answer": r.answer, "evidence": r.evidence, "provider": r.provider,
                       "created_at": r.created_at} for r in rows]}
