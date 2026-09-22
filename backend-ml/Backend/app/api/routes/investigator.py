from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models as m
from app.db.database import get_db
from app.schemas.investigator import InvestigatorAskIn, InvestigatorAskOut
from app.services import event_service, investigator_service

router = APIRouter(tags=["investigator"])


from starlette.concurrency import run_in_threadpool
from app.core.rate_limit import rate_limit

@router.post("/investigator/ask", response_model=InvestigatorAskOut, dependencies=[Depends(rate_limit(max_requests=20, window_seconds=60))])
async def ask(body: InvestigatorAskIn, db: Session = Depends(get_db)):
    ctx = await run_in_threadpool(lambda: event_service.get_event_context(body.event_id, db) if body.event_id else None)
    res = await investigator_service.ask_investigator(body.question, ctx)
    if body.event_id and ctx:
        def _save_session():
            db.add(m.InvestigationSession(event_id=body.event_id, question=body.question,
                                          answer=res["answer"], evidence=res["evidence"],
                                          provider=res["provider"]))
            db.commit()
        await run_in_threadpool(_save_session)
    return InvestigatorAskOut(answer=res["answer"], evidence=res["evidence"],
                              provider=res["provider"], event_id=body.event_id)


@router.get("/investigator/sessions")
def sessions(event_id: str | None = None, limit: int = 20, db: Session = Depends(get_db)):
    q = select(m.InvestigationSession).order_by(m.InvestigationSession.created_at.desc()).limit(min(limit, 100))
    if event_id:
        q = q.where(m.InvestigationSession.event_id == event_id)
    rows = db.execute(q).scalars().all()
    return {"items": [{"id": r.id, "event_id": r.event_id, "question": r.question,
                       "answer": r.answer, "evidence": r.evidence, "provider": r.provider,
                       "created_at": r.created_at} for r in rows]}
