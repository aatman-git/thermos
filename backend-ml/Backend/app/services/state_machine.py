"""Incident Lifecycle State Machine.
Canonical lifecycle:
DETECTED -> CLASSIFIED -> ASSESSED -> ALERTED -> ACKNOWLEDGED -> EN_ROUTE -> ARRIVED -> CONTAINED -> RESOLVED
Direct shortcut:
ACKNOWLEDGED -> RESOLVED
"""
from __future__ import annotations

from enum import Enum


class IncidentStatus(str, Enum):
    DETECTED = "DETECTED"
    CLASSIFIED = "CLASSIFIED"
    ASSESSED = "ASSESSED"
    ALERTED = "ALERTED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EN_ROUTE = "EN_ROUTE"
    ARRIVED = "ARRIVED"
    CONTAINED = "CONTAINED"
    RESOLVED = "RESOLVED"


# Allowed transitions map
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    IncidentStatus.DETECTED.value: {IncidentStatus.CLASSIFIED.value},
    IncidentStatus.CLASSIFIED.value: {IncidentStatus.ASSESSED.value},
    IncidentStatus.ASSESSED.value: {IncidentStatus.ALERTED.value, IncidentStatus.RESOLVED.value},
    IncidentStatus.ALERTED.value: {IncidentStatus.ACKNOWLEDGED.value},
    IncidentStatus.ACKNOWLEDGED.value: {IncidentStatus.EN_ROUTE.value, IncidentStatus.RESOLVED.value},
    IncidentStatus.EN_ROUTE.value: {IncidentStatus.ARRIVED.value},
    IncidentStatus.ARRIVED.value: {IncidentStatus.CONTAINED.value},
    IncidentStatus.CONTAINED.value: {IncidentStatus.RESOLVED.value},
    IncidentStatus.RESOLVED.value: set(),  # Terminal state
}

# Legacy mapping compatibility so existing data/tests transition seamlessly
LEGACY_STATUS_MAP: dict[str, str] = {
    "active": IncidentStatus.ASSESSED.value,
    "reviewed": IncidentStatus.ACKNOWLEDGED.value,
    "investigating": IncidentStatus.ACKNOWLEDGED.value,
    "dismissed": IncidentStatus.RESOLVED.value,
    "resolved": IncidentStatus.RESOLVED.value,
}


def normalize_status(status_str: str) -> str:
    s = status_str.strip().upper()
    if s in [e.value for e in IncidentStatus]:
        return s
    low = status_str.strip().lower()
    if low in LEGACY_STATUS_MAP:
        return LEGACY_STATUS_MAP[low]
    raise ValueError(f"Unknown incident status: '{status_str}'")


def can_transition(current_status: str, target_status: str) -> bool:
    curr = normalize_status(current_status)
    tgt = normalize_status(target_status)
    if curr == tgt:
        return True
    return tgt in ALLOWED_TRANSITIONS.get(curr, set())


def validate_transition(current_status: str, target_status: str) -> str:
    curr = normalize_status(current_status)
    tgt = normalize_status(target_status)
    if curr == tgt:
        return tgt
    allowed = ALLOWED_TRANSITIONS.get(curr, set())
    if tgt not in allowed:
        allowed_str = ", ".join(sorted(allowed)) if allowed else "none (terminal state)"
        raise ValueError(
            f"Invalid transition from '{curr}' to '{tgt}'. Allowed next transitions: {allowed_str}"
        )
    return tgt
