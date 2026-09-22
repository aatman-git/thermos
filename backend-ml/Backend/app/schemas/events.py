from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.services.state_machine import IncidentStatus

DataMode = Literal["demo", "live"]
EventStatus = str


class FirmsObservationIn(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    acquired_at: datetime | None = None
    brightness_k: float | None = Field(None, ge=150, le=600)
    bright_ti4: float | None = None
    frp_mw: float | None = Field(None, ge=0, le=10000)
    confidence: str | int | float | None = None
    daynight: str | None = None
    satellite: str | None = None
    instrument: str | None = None
    version: str | None = None
    scan_km: float | None = None
    track_km: float | None = None
    source: str | None = None
    acq_date: str | None = None
    acq_time: str | None = None


class EventMapItem(BaseModel):
    id: str
    latitude: float
    longitude: float
    classification: str | None = None
    confidence: float | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    persistence_hours: float | None = None
    frp_mw: float | None = None
    status: str
    data_mode: str | None = None


class EventDetail(BaseModel):
    id: str
    latitude: float
    longitude: float
    classification: str | None = None
    confidence: float | None = None
    probabilities: dict[str, float] | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    risk_factors: dict[str, Any] | None = None
    temporal: dict[str, Any] | None = None
    observations: list[dict[str, Any]] | None = None
    geospatial: dict[str, Any] | None = None
    population: dict[str, Any] | None = None
    land_cover: str | None = None
    explainability: dict[str, Any] | None = None
    data_quality: dict[str, Any] | None = None
    data_mode: str
    status: str
    model_version: str | None = None
    enrichment_sources: dict[str, Any] | None = None
    first_detected_at: datetime | None = None
    last_detected_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class StatusUpdate(BaseModel):
    status: EventStatus
