"""Tests for Part 1: Incident Lifecycle State Machine."""
from app.db import models as m
from app.services.state_machine import IncidentStatus, can_transition, validate_transition


def test_state_machine_transition_logic():
    # Valid transitions
    assert validate_transition("DETECTED", "CLASSIFIED") == "CLASSIFIED"
    assert validate_transition("CLASSIFIED", "ASSESSED") == "ASSESSED"
    assert validate_transition("ASSESSED", "ALERTED") == "ALERTED"
    assert validate_transition("ALERTED", "ACKNOWLEDGED") == "ACKNOWLEDGED"
    assert validate_transition("ACKNOWLEDGED", "EN_ROUTE") == "EN_ROUTE"
    assert validate_transition("EN_ROUTE", "ARRIVED") == "ARRIVED"
    assert validate_transition("ARRIVED", "CONTAINED") == "CONTAINED"
    assert validate_transition("CONTAINED", "RESOLVED") == "RESOLVED"

    # Direct shortcut: ACKNOWLEDGED -> RESOLVED
    assert validate_transition("ACKNOWLEDGED", "RESOLVED") == "RESOLVED"

    # Invalid jump: DETECTED -> CONTAINED
    assert not can_transition("DETECTED", "CONTAINED")


def test_status_api_endpoints(client):
    # Process an event to create it
    obs = {"latitude": 25.43, "longitude": 81.85, "brightness_k": 348.7,
           "frp_mw": 85.0, "confidence": "h", "daynight": "N"}
    r = client.post("/api/events/process", json=obs)
    assert r.status_code == 200
    eid = r.json()["event"]["id"]

    # Verify initial status is ALERTED (due to high FRP 85.0 exceeding threshold)
    det = client.get(f"/api/events/{eid}").json()
    assert det["status"] in ("ALERTED", "ASSESSED")

    if det["status"] == "ASSESSED":
        # Transition to ALERTED
        r_alert = client.patch(f"/api/events/{eid}/status", json={"status": "ALERTED"})
        assert r_alert.status_code == 200
        assert r_alert.json()["status"] == "ALERTED"

    # Valid: ALERTED -> ACKNOWLEDGED via /api/incidents/{id}/status alias
    r_ack = client.patch(f"/api/incidents/{eid}/status", json={"status": "ACKNOWLEDGED"})
    assert r_ack.status_code == 200
    assert r_ack.json()["status"] == "ACKNOWLEDGED"

    # Invalid: ACKNOWLEDGED -> CONTAINED (skipping EN_ROUTE, ARRIVED) should return 409
    r_bad = client.patch(f"/api/events/{eid}/status", json={"status": "CONTAINED"})
    assert r_bad.status_code == 409

    # Valid shortcut: ACKNOWLEDGED -> RESOLVED
    r_res = client.patch(f"/api/events/{eid}/status", json={"status": "RESOLVED"})
    assert r_res.status_code == 200
    assert r_res.json()["status"] == "RESOLVED"
