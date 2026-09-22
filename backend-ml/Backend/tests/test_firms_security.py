"""Test suite verifying FIRMS ingestion security, secret isolation, rate limiting, and RBAC."""
from __future__ import annotations

import logging
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, verify_access_token
from app.services.firms_service import sanitize_and_validate_row, normalize_observation, FirmsService
from app.core.rate_limit import RateLimiter
from app.core.cache import get_cache

client = TestClient(app)


def test_firms_csv_sanitization():
    """Verify malformed or dangerous coordinates and values are rejected."""
    # Out of bounds lat
    bad_lat = sanitize_and_validate_row({"latitude": 95.5, "longitude": 75.0, "acq_date": "2026-03-20"})
    assert bad_lat is None

    # Out of bounds lon
    bad_lon = sanitize_and_validate_row({"latitude": 20.5, "longitude": -195.0, "acq_date": "2026-03-20"})
    assert bad_lon is None

    # Non-numeric garbage
    bad_coords = sanitize_and_validate_row({"latitude": "DROP TABLE", "longitude": "SELECT *", "acq_date": "2026-03-20"})
    assert bad_coords is None

    # Negative FRP should be sanitized to None
    neg_frp = sanitize_and_validate_row({"latitude": 22.0, "longitude": 80.0, "frp": -50.0, "brightness": 320.0})
    assert neg_frp is not None
    assert neg_frp["frp_mw"] is None

    # Valid row
    valid = normalize_observation({"latitude": 21.15, "longitude": 79.08, "brightness": 330.5, "frp": 15.2, "acq_date": "2026-03-20", "acq_time": "0830"})
    assert valid is not None
    assert valid["latitude"] == 21.15
    assert valid["longitude"] == 79.08
    assert valid["brightness_k"] == 330.5
    assert valid["frp_mw"] == 15.2


def test_jwt_token_flow():
    """Verify RFC 7519 HMAC-SHA256 JWT tokens encode, decode, and expire."""
    token = create_access_token("analyst_user_1", "Analyst", expires_in_seconds=300)
    payload = verify_access_token(token)
    assert payload is not None
    assert payload["sub"] == "analyst_user_1"
    assert payload["role"] == "Analyst"

    # Expired token
    expired_token = create_access_token("expired_user", "Admin", expires_in_seconds=-10)
    assert verify_access_token(expired_token) is None

    # Tampered token
    tampered = token[:-4] + "abcd"
    assert verify_access_token(tampered) is None


def test_security_headers_middleware():
    """Verify production security headers are attached to API responses."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_rate_limiter():
    """Verify sliding-window rate limiter blocks bursts exceeding quota."""
    limiter = RateLimiter(max_requests=3, window_seconds=10)
    client_id = "test_ip_1"

    allowed1, _ = limiter.is_allowed(client_id)
    allowed2, _ = limiter.is_allowed(client_id)
    allowed3, _ = limiter.is_allowed(client_id)
    blocked, retry_after = limiter.is_allowed(client_id)

    assert allowed1 is True
    assert allowed2 is True
    assert allowed3 is True
    assert blocked is False
    assert retry_after > 0


def test_internal_firms_ingest_rbac():
    """Verify POST /api/internal/ingest/firms is protected by Admin role."""
    # Public / unauthenticated
    resp_public = client.post("/api/internal/ingest/firms", json={"max_obs": 10}, headers={"X-User-Role": "Public"})
    assert resp_public.status_code == 403

    # Analyst
    resp_analyst = client.post("/api/internal/ingest/firms", json={"max_obs": 10}, headers={"X-User-Role": "Analyst"})
    assert resp_analyst.status_code == 403

    # Admin (succeeds or returns 200 status with skipped reason when live mode disabled)
    resp_admin = client.post("/api/internal/ingest/firms", json={"max_obs": 10}, headers={"X-User-Role": "Admin"})
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert "status" in data
    assert "ingested" in data


def test_cache_ttl():
    """Verify cache stores and retrieves values with TTL."""
    cache = get_cache()
    key = "test_key_123"
    cache.set(key, {"sample": "data"}, ttl_seconds=10)
    cached = cache.get(key)
    assert cached == {"sample": "data"}


def test_secret_redacting_filter():
    """Verify logging filter scrubs secret keys from log messages."""
    from app.core.logging import SecretRedactingFilter
    filt = SecretRedactingFilter()
    rec = logging.LogRecord("thermos.test", logging.INFO, "", 0, "Calling URL /area/csv/abcdef0123456789abcdef0123456789/VIIRS/world/1", (), None)
    filt.filter(rec)
    assert "abcdef0123456789abcdef0123456789" not in rec.getMessage()
    assert "***REDACTED***" in rec.getMessage()
