"""Internal administration and data pipeline endpoints.
Strictly protected by Admin role and rate limiting.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.rate_limit import rate_limit
from app.core.security import RoleAdmin
from app.workers.firms_ingestion import poll_once

router = APIRouter(prefix="/internal", tags=["internal"])


class FirmsIngestRequest(BaseModel):
    source: str = Field("VIIRS_SNPP_NRT", max_length=32)
    bbox: str | None = Field(None, max_length=64, description="min_lon,min_lat,max_lon,max_lat")
    max_obs: int = Field(200, ge=1, le=1000)
    data_mode: str = Field("live", pattern="^(live|demo)$")


class FirmsIngestResponse(BaseModel):
    status: str
    fetched: int
    ingested: int
    duplicates_skipped: int
    errors: int
    reason: str | None = None


@router.post(
    "/ingest/firms",
    response_model=FirmsIngestResponse,
    dependencies=[Depends(RoleAdmin), Depends(rate_limit(max_requests=5, window_seconds=60))],
    summary="Trigger NASA FIRMS manual ingestion (Admin only)",
)
def trigger_firms_ingest(
    body: FirmsIngestRequest = FirmsIngestRequest(),
    user: dict = Depends(RoleAdmin),
) -> dict[str, Any]:
    """Manually trigger NASA FIRMS ingestion pipeline.
    Admin access only. Subject to rate limits.
    Validates coordinates, deduplicates against database, and stores in PostGIS.
    """
    res = poll_once(
        data_mode=body.data_mode,
        max_obs=body.max_obs,
        source=body.source,
        bbox=body.bbox,
    )
    if res.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NASA FIRMS ingestion upstream failed: {res.get('reason')}",
        )
    return res
