from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PredictFeaturesIn(BaseModel):
    brightness_k: float
    frp_mw: float
    firms_confidence_pct: float
    daynight: int | str
    observation_count_7d: int | float
    persistence_hours_7d: float
    frp_trend_pct: float | None = None
    industrial_proximity_km: float
    refinery_proximity_km: float
    mine_proximity_km: float
    forest_proximity_km: float
    cropland_proximity_km: float
    population_5km: float | int
    land_cover: str


class PredictOut(BaseModel):
    predicted_class: str
    display_class: str | None = None
    confidence: float
    probabilities: dict[str, float]
    model_version: str
    feature_values: dict[str, Any]
    feature_quality: dict[str, Any] = {}
    low_margin: bool = False
    needs_review: bool = False
    explanations: dict[str, Any] | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    has_hotspot: bool = True
    location: dict[str, float] | None = None
    message: str | None = None
    is_industrial: bool = False
    nearest_industrial_distance_m: float | None = None
    relevant_tags: dict[str, Any] = {}
    matched_tags: dict[str, Any] = {}
    industrial_context: dict[str, Any] | None = None
    osm_context: dict[str, Any] | None = None
    copernicus_context: dict[str, Any] | None = None
    land_cover_type: str | None = None
    ndvi_value: float | None = None
    explanation: str | None = None
    classification: dict[str, Any] | None = None
    firms: dict[str, Any] | None = None


class ProcessOut(BaseModel):
    event: dict[str, Any]
    classification: dict[str, Any]
    risk: dict[str, Any]
    temporal: dict[str, Any]
    geospatial: dict[str, Any]
    explainability: dict[str, Any]
    data_quality: dict[str, Any]
    meta: dict[str, Any]
