"""Initial THERMOS schema with PostGIS extension + spatial + filter indexes."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "thermal_events",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("external_event_id", sa.String(64), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geom_wkt", sa.Text(), nullable=True),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("observation_count", sa.Integer(), server_default="1"),
        sa.Column("persistence_hours", sa.Float(), server_default="0"),
        sa.Column("current_classification", sa.String(64), nullable=True),
        sa.Column("classification_confidence", sa.Float(), nullable=True),
        sa.Column("risk_score", sa.Float(), nullable=True),
        sa.Column("risk_level", sa.String(16), nullable=True),
        sa.Column("data_mode", sa.String(8), server_default="demo"),
        sa.Column("status", sa.String(24), server_default="active"),
        sa.Column("data_quality_score", sa.Float(), nullable=True),
        sa.Column("feature_values", sa.JSON(), nullable=True),
        sa.Column("geospatial_context", sa.JSON(), nullable=True),
        sa.Column("temporal_context", sa.JSON(), nullable=True),
        sa.Column("model_version", sa.String(64), nullable=True),
        sa.Column("enrichment_sources", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("ALTER TABLE thermal_events ADD COLUMN IF NOT EXISTS geom geography(Point,4326)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_events_geom ON thermal_events USING GIST (geom)")
    for col in ("last_detected_at", "current_classification", "risk_level", "status", "data_mode"):
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_events_{col} ON thermal_events ({col})")
    op.create_table(
        "thermal_observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("thermal_events.id"), nullable=True),
        sa.Column("source", sa.String(32), server_default="VIIRS"),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geom_wkt", sa.Text(), nullable=True),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("brightness_k", sa.Float(), nullable=True),
        sa.Column("frp_mw", sa.Float(), nullable=True),
        sa.Column("confidence", sa.String(16), nullable=True),
        sa.Column("confidence_raw", sa.String(32), nullable=True),
        sa.Column("confidence_numeric", sa.Float(), nullable=True),
        sa.Column("daynight", sa.String(4), nullable=True),
        sa.Column("satellite", sa.String(16), nullable=True),
        sa.Column("instrument", sa.String(32), nullable=True),
        sa.Column("scan_km", sa.Float(), nullable=True),
        sa.Column("track_km", sa.Float(), nullable=True),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("ALTER TABLE thermal_observations ADD COLUMN IF NOT EXISTS geom geography(Point,4326)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_obs_geom ON thermal_observations USING GIST (geom)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_obs_event_acq ON thermal_observations (event_id, acquired_at)")
    op.create_table(
        "predictions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("feature_schema_version", sa.String(16), server_default="v1"),
        sa.Column("predicted_class", sa.String(64), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("probabilities", sa.JSON(), nullable=False),
        sa.Column("explanations", sa.JSON(), nullable=True),
        sa.Column("low_margin", sa.Boolean(), server_default=sa.false()),
        sa.Column("needs_review", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "risk_assessments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("risk_engine_version", sa.String(16), server_default="risk-v1"),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(16), nullable=False),
        sa.Column("factors", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("predicted_class", sa.String(64), nullable=True),
        sa.Column("reviewed_class", sa.String(64), nullable=True),
        sa.Column("review_status", sa.String(24), server_default="pending"),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "investigation_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("thermal_events.id", ondelete="CASCADE"), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=True),
        sa.Column("provider", sa.String(24), server_default="rules"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    for tbl in ("predictions", "risk_assessments", "reviews", "investigation_sessions"):
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_{tbl}_event ON {tbl} (event_id)")


def downgrade() -> None:
    for t in ("investigation_sessions", "reviews", "risk_assessments", "predictions",
              "thermal_observations", "thermal_events"):
        op.execute(f"DROP TABLE IF EXISTS {t}")
