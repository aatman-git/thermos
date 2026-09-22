"""Tests for Part 3 (RBAC) and Part 4 (Immutable Audit Trail)."""
from app.core.security import UserRole, normalize_role


def test_role_normalization():
    assert normalize_role("analyst") == UserRole.ANALYST
    assert normalize_role("Authority") == UserRole.AUTHORITY
    assert normalize_role("RESPONDER") == UserRole.RESPONDER
    assert normalize_role("admin") == UserRole.ADMIN
    assert normalize_role("unknown") == UserRole.PUBLIC


def test_rbac_and_audit_flow(client):
    obs = {"latitude": 21.93, "longitude": 85.13, "brightness_k": 360.0,
           "frp_mw": 45.0, "confidence": "h", "daynight": "D"}

    # 1. Classify with unauthorized role (Public) -> 403
    r_pub = client.post("/api/events/process", json=obs, headers={"X-User-Role": "Public"})
    assert r_pub.status_code == 403

    # 2. Classify with unauthorized role (Responder) -> 403
    r_resp_fail = client.post("/api/events/process", json=obs, headers={"X-User-Role": "Responder"})
    assert r_resp_fail.status_code == 403

    # 3. Classify with authorized role (Analyst) -> 200
    r_analyst = client.post("/api/events/process", json=obs, headers={"X-User-Role": "Analyst"})
    assert r_analyst.status_code == 200
    eid = r_analyst.json()["event"]["id"]

    # 4. Alert dispatch with unauthorized role (Analyst) -> 403
    r_alert_fail = client.post(f"/api/alerts/{eid}/dispatch", headers={"X-User-Role": "Analyst"})
    assert r_alert_fail.status_code == 403

    # 5. Alert dispatch with authorized role (Authority) -> 200
    r_alert_ok = client.post(f"/api/alerts/{eid}/dispatch", headers={"X-User-Role": "Authority", "X-User-Id": "commander-01"})
    assert r_alert_ok.status_code == 200
    assert r_alert_ok.json()["status"] == "ALERTED"

    # 6. Status change with unauthorized role (Public) -> 403
    r_stat_fail = client.patch(f"/api/incidents/{eid}/status", json={"status": "ACKNOWLEDGED"}, headers={"X-User-Role": "Public"})
    assert r_stat_fail.status_code == 403

    # 7. Status change with authorized role (Responder) -> 200
    r_stat_ok = client.patch(f"/api/incidents/{eid}/status", json={"status": "ACKNOWLEDGED"}, headers={"X-User-Role": "Responder", "X-User-Id": "responder-unit-7"})
    assert r_stat_ok.status_code == 200
    assert r_stat_ok.json()["status"] == "ACKNOWLEDGED"

    # 8. Check immutable audit trail timeline (Part 4)
    t_resp = client.get(f"/api/incidents/{eid}/timeline")
    assert t_resp.status_code == 200
    timeline = t_resp.json()["timeline"]
    assert len(timeline) >= 3  # CLASSIFICATION, ALERT_DISPATCH, STATUS_CHANGE
    actions = [item["action"] for item in timeline]
    assert "CLASSIFICATION" in actions
    assert "ALERT_DISPATCH" in actions
    assert "STATUS_CHANGE" in actions

    # Check user attribution
    alert_log = next(i for i in timeline if i["action"] == "ALERT_DISPATCH")
    assert alert_log["user_id"] == "commander-01"
    assert alert_log["user_role"] == "Authority"

    status_log = next(i for i in timeline if i["action"] == "STATUS_CHANGE")
    assert status_log["user_id"] == "responder-unit-7"
    assert status_log["from_status"] == "ALERTED"
    assert status_log["to_status"] == "ACKNOWLEDGED"
