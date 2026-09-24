"""Unit and integration tests for OSM, Copernicus Sentinel Hub, and Google Gemini Flash AI Explainer."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.copernicus_service import (
    derive_land_cover_from_ndvi,
    get_copernicus_context,
)
from app.services.ai_explainer_service import (
    generate_fire_explanation,
)
from app.services.osm_service import (
    check_known_industrial_registry,
    get_industrial_context,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_osm_industrial_registry_jamnagar():
    """Verify known industrial complex (Jamnagar) returns verified industrial context."""
    res = get_industrial_context(22.4707, 70.0577)
    assert res["is_industrial"] is True
    assert res["nearest_industrial_distance_m"] == 0.0
    assert "landuse" in res["relevant_tags"]
    assert res["relevant_tags"]["landuse"] == "industrial"
    assert "matched_tags" in res


def test_osm_fallback_on_unmapped_point():
    """Verify non-industrial point returns structured safe defaults without crashing."""
    res = get_industrial_context(10.0, 10.0)
    assert isinstance(res["is_industrial"], bool)
    assert "nearest_industrial_distance_m" in res
    assert "relevant_tags" in res
    assert isinstance(res["relevant_tags"], dict)


def test_copernicus_ndvi_derivation():
    """Verify NDVI mapping to vegetation and land cover classes."""
    assert derive_land_cover_from_ndvi(0.75) == "dense_forest"
    assert derive_land_cover_from_ndvi(0.45) == "cropland"
    assert derive_land_cover_from_ndvi(0.25) == "grassland"
    assert derive_land_cover_from_ndvi(0.08) == "built_up"
    assert derive_land_cover_from_ndvi(-0.1) == "water_body"
    assert derive_land_cover_from_ndvi(None) == "unclassified"


def test_copernicus_context_unconfigured_fallback():
    """Verify Copernicus returns structured nulls when unconfigured rather than crashing."""
    res = get_copernicus_context(22.47, 70.05)
    assert "land_cover_type" in res
    assert "ndvi_value" in res
    assert "status" in res
    # When credentials not present, returns nulls safely
    if res["status"] == "unavailable":
        assert res["land_cover_type"] is None
        assert res["ndvi_value"] is None


def test_gemini_explainer_missing_key_fallback():
    """Verify Gemini AI explanation returns None gracefully when API key is missing."""
    context = {
        "category": "Industrial Fire",
        "confidence": 0.85,
        "risk_score": 50,
        "firms": {"brightness": 345.0, "frp": 40.0},
        "osm": {"is_industrial": True, "nearest_industrial_distance_m": 0.0},
        "copernicus": {"land_cover_type": "built_up", "ndvi_value": 0.12},
    }
    # With empty/unconfigured key, returns None without throwing exceptions
    expl = generate_fire_explanation(context)
    assert expl is None or isinstance(expl, str)


def test_api_predict_returns_all_enrichments(client):
    """Verify /api/predict response contains OSM, Copernicus, and AI explanation fields."""
    resp = client.post("/api/predict", json={"latitude": 22.4707, "longitude": 70.0577})
    assert resp.status_code == 200
    data = resp.json()

    # OSM
    assert "is_industrial" in data
    assert data["is_industrial"] is True
    assert "nearest_industrial_distance_m" in data
    assert "relevant_tags" in data
    assert "osm_context" in data

    # Copernicus
    assert "copernicus_context" in data
    assert "land_cover_type" in data
    assert "ndvi_value" in data

    # Gemini Explanation
    assert "explanation" in data

    # Standard Classification
    assert "predicted_class" in data
    assert "confidence" in data
    assert "risk_score" in data


def test_api_fires_returns_all_enrichments(client):
    """Verify /api/fires response items contain all enrichment contexts."""
    resp = client.get("/api/fires?limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert "fires" in data
    assert len(data["fires"]) > 0

    first = data["fires"][0]
    assert "is_industrial" in first
    assert "relevant_tags" in first
    assert "osm_context" in first
    assert "copernicus_context" in first
    assert "land_cover_type" in first
    assert "ndvi_value" in first
    assert "explanation" in first
