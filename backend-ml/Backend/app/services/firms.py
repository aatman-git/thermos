"""NASA FIRMS API Client & Processing Service.
Calls https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SATELLITE_SOURCE}/{AREA}/{DAY_RANGE}
Reads FIRMS_API_KEY from environment, parses CSV into structured data,
and provides seamless graceful fallback to offline/demo data when needed.
"""
from __future__ import annotations

import csv
import io
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.firms_service import FirmsService, normalize_confidence, normalize_observation

log = get_logger("firms_api")

_firms_service: FirmsService | None = None


def get_firms_service() -> FirmsService:
    global _firms_service
    if _firms_service is None:
        _firms_service = FirmsService()
    return _firms_service


def get_firms_api_key() -> str:
    """Read API key from environment variable FIRMS_API_KEY (with FIRMS_MAP_KEY fallback)."""
    settings = get_settings()
    return settings.active_firms_key


def build_firms_url(api_key: str, source: str, bbox: str, day_range: int) -> str:
    """Format: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SATELLITE_SOURCE}/{AREA}/{DAY_RANGE}"""
    settings = get_settings()
    base = settings.FIRMS_API_BASE_URL.rstrip("/")
    return f"{base}/area/csv/{api_key}/{source}/{bbox}/{day_range}"


def parse_firms_csv(csv_text: str, source: str = "VIIRS_SNPP_NRT") -> list[dict[str, Any]]:
    """Parse raw NASA FIRMS CSV text into structured records with numeric coordinates,
    brightness, confidence, FRP, and timestamps.
    """
    clean_text = csv_text.strip()
    if not clean_text or "Invalid MAP_KEY" in clean_text or "Bad MAP_KEY" in clean_text:
        return []

    records: list[dict[str, Any]] = []
    reader = csv.DictReader(io.StringIO(clean_text))
    for row in reader:
        norm = normalize_observation(dict(row), default_source=source)
        if norm is not None:
            # Ensure ISO-formatted timestamps
            if isinstance(norm.get("acquired_at"), datetime):
                norm["acquired_at"] = norm["acquired_at"].isoformat()
            records.append(norm)
    return records


def fetch_firms_data(
    bbox: str = "68,6,98,38",
    day_range: int = 1,
    source: str = "VIIRS_SNPP_NRT",
    limit: int = 500,
) -> tuple[list[dict[str, Any]], str, str | None]:
    """Fetch live data from NASA FIRMS API or fallback to realistic demo data."""
    service = get_firms_service()
    return service.fetch_fires_with_fallback(bbox=bbox, day_range=day_range, source=source, limit=limit)
