"""Unit tests: FIRMS normalization, confidence, distances, temporal, association, features, risk."""
from datetime import datetime, timedelta, timezone

from app.ml.feature_schema import validate_feature_dict
from app.services import geo_service, temporal_service
from app.services.firms_service import normalize_confidence, normalize_observation
from app.services.risk_service import calculate_risk


def test_confidence_mapping():
    assert normalize_confidence("h")["confidence_numeric"] == 90.0
    assert normalize_confidence("l")["confidence_level"] == "low"
    assert normalize_confidence(85)["confidence_numeric"] == 85
    assert normalize_confidence(None)["confidence_numeric"] is None


def test_normalize_observation():
    o = normalize_observation({"latitude": 23.0, "longitude": 72.5, "acq_date": "2026-08-31",
                               "acq_time": "0232", "brightness": 348.7, "frp": 31.4,
                               "confidence": "h", "daynight": "n"})
    assert o["latitude"] == 23.0 and o["daynight"] == "N"
    assert o["confidence_numeric"] == 90.0
    assert o["acquired_at"].year == 2026


def test_haversine_not_euclidean():
    d = geo_service.haversine_km(23.0, 72.5, 23.02, 72.57)
    assert 5 < d < 12  # ~7.5km; degree-euclidean would give ~0.07


def test_temporal_features():
    now = datetime.now(timezone.utc)
    obs = [{"acquired_at": now - timedelta(hours=h), "frp_mw": 10 + h} for h in [70, 50, 30, 10]]
    t = temporal_service.compute_temporal_features(obs, now=now)
    assert t["observation_count_7d"] == 4
    assert t["persistence_hours_7d"] == 60.0
    assert t["frp_trend_pct"] is not None
    single = temporal_service.compute_temporal_features([obs[0]], now=now)
    assert single["frp_trend_pct"] is None and "frp_trend_reason" in single


def test_event_association_thresholds():
    class E:
        def __init__(self, lat, lon, h):
            self.latitude, self.longitude = lat, lon
            self.last_detected_at = datetime.now(timezone.utc) - timedelta(hours=h)
            self.first_detected_at = self.last_detected_at
    near = E(23.0, 72.5, 5)
    far = E(28.0, 77.0, 5)
    now = datetime.now(timezone.utc)
    assert geo_service.find_candidate_event(23.001, 72.501, now, [far, near], 2.0, 72.0) is near
    assert geo_service.find_candidate_event(23.001, 72.501, now, [far], 2.0, 72.0) is None


def test_feature_validation():
    good = {"brightness_k": 348.7, "frp_mw": 31.4, "firms_confidence_pct": 90, "daynight": 0,
            "observation_count_7d": 5, "persistence_hours_7d": 40.0, "frp_trend_pct": 10.0,
            "industrial_proximity_km": 1.2, "refinery_proximity_km": 4.6, "mine_proximity_km": 42.0,
            "forest_proximity_km": 31.4, "cropland_proximity_km": 18.2, "population_5km": 18400,
            "land_cover": "Industrial"}
    assert validate_feature_dict(good)["ok"]
    bad = dict(good, land_cover="Moon")
    v = validate_feature_dict(bad)
    assert not v["ok"] and v["errors"]
    missing = dict(good); del missing["frp_mw"]
    assert "frp_mw" in validate_feature_dict(missing)["missing_features"]


def test_risk_engine_levels():
    feats = {"frp_mw": 60, "brightness_k": 380, "observation_count_7d": 17, "persistence_hours_7d": 68,
             "population_5km": 18400, "industrial_proximity_km": 1.2, "refinery_proximity_km": 4.6,
             "frp_trend_pct": 23.1, "firms_confidence_pct": 90}
    r = calculate_risk(feats)
    assert r["risk_level"] in ("HIGH", "CRITICAL")
    assert abs(sum(r["factors"].values()) - r["risk_score"]) < 0.2
    low = calculate_risk({"frp_mw": 2, "brightness_k": 305, "observation_count_7d": 1,
                          "persistence_hours_7d": 0, "population_5km": 100,
                          "industrial_proximity_km": 80, "refinery_proximity_km": 90,
                          "frp_trend_pct": -20, "firms_confidence_pct": 30})
    assert low["risk_level"] == "LOW"


def test_firms_url_format():
    from app.services.firms_service import FirmsService
    fs = FirmsService()
    fs.settings.FIRMS_API_KEY = "dummy_key"
    fs.settings.FIRMS_MAP_KEY = "dummy_key"
    url = fs._url("VIIRS_SNPP_NRT", "68,6,98,38", 2)
    assert "/area/csv/dummy_key/VIIRS_SNPP_NRT/68,6,98,38/2" in url
    assert "/world/" not in url


def test_investigator_rule_answer():
    from app.services.investigator_service import rule_answer
    ans, ev = rule_answer("What next action should we take?", {"id": "TEST-1", "geospatial": {}, "temporal": {}, "classification": {}, "risk": {}})
    assert isinstance(ans, str)
    assert isinstance(ev, list)
    assert not isinstance(ans, tuple)

