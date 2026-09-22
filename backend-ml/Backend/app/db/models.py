"""SQLAlchemy models. Geometry stored as WKT text for portability;
on PostgreSQL the Alembic migration adds PostGIS geography columns + GIST indexes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ThermalEvent(Base):
    __tablename__ = "thermal_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    external_event_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geom_wkt: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    observation_count: Mapped[int] = mapped_column(Integer, default=1)
    persistence_hours: Mapped[float] = mapped_column(Float, default=0.0)
    current_classification: Mapped[str | None] = mapped_column(String(64), nullable=True)
    classification_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    data_mode: Mapped[str] = mapped_column(String(8), default="demo")
    status: Mapped[str] = mapped_column(String(24), default="DETECTED")
    data_quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # denormalised latest context for fast detail responses
    feature_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    geospatial_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    temporal_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enrichment_sources: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    observations: Mapped[list["ThermalObservation"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    risks: Mapped[list["RiskAssessment"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    logs: Mapped[list["IncidentLog"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class ThermalObservation(Base):
    __tablename__ = "thermal_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str | None] = mapped_column(ForeignKey("thermal_events.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="VIIRS")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geom_wkt: Mapped[str | None] = mapped_column(Text, nullable=True)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    brightness_k: Mapped[float | None] = mapped_column(Float, nullable=True)
    frp_mw: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(16), nullable=True)
    confidence_raw: Mapped[str | None] = mapped_column(String(32), nullable=True)
    confidence_numeric: Mapped[float | None] = mapped_column(Float, nullable=True)
    daynight: Mapped[str | None] = mapped_column(String(4), nullable=True)
    satellite: Mapped[str | None] = mapped_column(String(16), nullable=True)
    instrument: Mapped[str | None] = mapped_column(String(32), nullable=True)
    scan_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    track_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    event: Mapped[ThermalEvent | None] = relationship(back_populates="observations")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("thermal_events.id"), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    feature_schema_version: Mapped[str] = mapped_column(String(16), default="v1")
    predicted_class: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    probabilities: Mapped[dict] = mapped_column(JSON, nullable=False)
    explanations: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    low_margin: Mapped[bool] = mapped_column(default=False)
    needs_review: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    event: Mapped[ThermalEvent] = relationship(back_populates="predictions")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("thermal_events.id"), nullable=False)
    risk_engine_version: Mapped[str] = mapped_column(String(16), default="risk-v1")
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    factors: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    event: Mapped[ThermalEvent] = relationship(back_populates="risks")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("thermal_events.id"), nullable=False)
    predicted_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reviewed_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    review_status: Mapped[str] = mapped_column(String(24), default="pending")
    reviewer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class InvestigationSession(Base):
    __tablename__ = "investigation_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str | None] = mapped_column(ForeignKey("thermal_events.id"), nullable=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[list | None] = mapped_column(JSON, nullable=True)
    provider: Mapped[str] = mapped_column(String(24), default="rules")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="Public")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class IncidentLog(Base):
    __tablename__ = "incident_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)  # "STATUS_CHANGE", "CLASSIFICATION", "ALERT_DISPATCH"
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    event: Mapped["ThermalEvent"] = relationship(back_populates="logs")

