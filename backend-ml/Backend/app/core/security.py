"""Role-Based Access Control (RBAC) definitions, JWT validation, and FastAPI security dependencies."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from enum import Enum
from typing import Any, Callable

from fastapi import Depends, Header, HTTPException, Query, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db

security_scheme = HTTPBearer(auto_error=False)


class UserRole(str, Enum):
    ANALYST = "Analyst"
    AUTHORITY = "Authority"
    RESPONDER = "Responder"
    ADMIN = "Admin"
    PUBLIC = "Public"


# Normalization helper for role comparison (case-insensitive)
def normalize_role(role_name: str | None) -> UserRole:
    if not role_name:
        return UserRole.PUBLIC
    val = role_name.strip().lower()
    mapping = {
        "analyst": UserRole.ANALYST,
        "authority": UserRole.AUTHORITY,
        "responder": UserRole.RESPONDER,
        "admin": UserRole.ADMIN,
        "public": UserRole.PUBLIC,
    }
    return mapping.get(val, UserRole.PUBLIC)


# ==============================================================================
# RFC 7519 Compliant JWT Helpers (HS256) without third-party dependencies
# ==============================================================================

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("ascii"))


def create_access_token(user_id: str, role: str, expires_in_seconds: int = 3600) -> str:
    """Sign a JWT access token with the application's SECRET_KEY."""
    s = get_settings()
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    segment1 = _base64url_encode(header_bytes)
    segment2 = _base64url_encode(payload_bytes)
    message = f"{segment1}.{segment2}".encode("ascii")

    sig = hmac.new(s.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    segment3 = _base64url_encode(sig)

    return f"{segment1}.{segment2}.{segment3}"


def verify_access_token(token: str) -> dict[str, Any] | None:
    """Verify signature and expiration of a JWT token. Returns payload or None if invalid."""
    s = get_settings()
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts

        message = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(s.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        actual_sig = _base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp") and int(payload["exp"]) < int(time.time()):
            return None  # Expired

        return payload
    except Exception:
        return None


def get_current_user(
    auth: HTTPAuthorizationCredentials | None = Security(security_scheme),
    x_user_role: str | None = Header(None, alias="X-User-Role"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    role: str | None = Query(None, alias="as_role"),
    db: Session = Depends(get_db),
) -> dict:
    """Resolve current user context.
    Priority order:
    1. Bearer JWT token in Authorization header (validated against SECRET_KEY)
    2. Explicit X-User-Role header (for internal/service-to-service calls)
    3. as_role query parameter (dev convenience only)
    4. Environment default: Public in production, Admin in dev/test.
    """
    s = get_settings()

    # 1. Bearer JWT validation
    if auth and auth.credentials:
        payload = verify_access_token(auth.credentials)
        if payload is not None:
            user_role = normalize_role(payload.get("role"))
            user_id = payload.get("sub", f"jwt-{user_role.value.lower()}")
            return {
                "id": user_id,
                "role": user_role.value,
                "is_authenticated": True,
            }
        # If token was provided but invalid/expired, strictly reject
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Header or query param (dev / internal)
    if x_user_role is not None or (role is not None and not s.is_production):
        user_role = normalize_role(x_user_role or role)
    else:
        user_role = UserRole.PUBLIC if s.is_production else UserRole.ADMIN

    user_id = x_user_id or f"anon-{user_role.value.lower()}"
    return {
        "id": user_id,
        "role": user_role.value,
        "is_authenticated": user_role != UserRole.PUBLIC,
    }


def require_roles(allowed_roles: list[UserRole]) -> Callable:
    """Dependency factory ensuring user has one of the allowed roles."""
    allowed_values = {r.value for r in allowed_roles}

    def role_checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{user['role']}' lacks permission. Required roles: {sorted(allowed_values)}",
            )
        return user

    return role_checker


# Canonical role dependency aliases matching Part 3 specs
RoleAdmin = require_roles([UserRole.ADMIN])
RoleClassify = require_roles([UserRole.ANALYST, UserRole.AUTHORITY, UserRole.ADMIN])
RoleAlert = require_roles([UserRole.AUTHORITY, UserRole.ADMIN])
RoleStatusChange = require_roles([UserRole.AUTHORITY, UserRole.RESPONDER, UserRole.ADMIN])
