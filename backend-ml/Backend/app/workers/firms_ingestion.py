"""FIRMS ingestion worker: resilient pipeline with database deduplication,
geometry storage (SRID 4326), retry/timeout, and graceful failure handling.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.core.logging import get_logger
from app.db import models as m
from app.db.database import SessionLocal
from app.services import event_service
from app.services.firms_service import FirmsService

log = get_logger("worker")

_seen: set[tuple] = set()


def poll_once(
    data_mode: str = "live",
    max_obs: int = 200,
    source: str = "VIIRS_SNPP_NRT",
    bbox: str | None = None,
) -> dict[str, Any]:
    """Poll NASA FIRMS, deduplicate against existing database records, and ingest.
    Never crashes caller; returns execution summary stats.
    """
    svc = FirmsService()
    if not svc.enabled:
        log.info("FIRMS poll skipped (live mode disabled or no MAP_KEY configured)")
        return {
            "status": "skipped",
            "reason": "FIRMS live mode disabled or missing key",
            "fetched": 0,
            "ingested": 0,
            "duplicates_skipped": 0,
            "errors": 0,
        }

    try:
        if bbox:
            min_lon, min_lat, max_lon, max_lat = [float(x.strip()) for x in bbox.split(",")]
            obs = svc.get_events_by_area(min_lon, min_lat, max_lon, max_lat, source=source)
        else:
            obs = svc.get_recent_events(source=source)
    except Exception as e:  # noqa: BLE001
        log.warning("FIRMS poll network/API call failed gracefully: %s", e)
        return {
            "status": "error",
            "reason": str(e),
            "fetched": 0,
            "ingested": 0,
            "duplicates_skipped": 0,
            "errors": 1,
        }

    ingested_count = 0
    dup_count = 0
    error_count = 0

    with SessionLocal() as db:
        for o in obs[:max_obs]:
            lat = o["latitude"]
            lon = o["longitude"]
            acq = o["acquired_at"]

            # 1. In-memory batch duplicate check
            mem_key = (round(lat, 4), round(lon, 4), str(acq))
            if mem_key in _seen:
                dup_count += 1
                continue

            # 2. Database duplicate check against existing PostGIS/SQL observation records
            db_dup = db.execute(
                select(m.ThermalObservation.id)
                .where(
                    m.ThermalObservation.latitude.between(lat - 0.0005, lat + 0.0005),
                    m.ThermalObservation.longitude.between(lon - 0.0005, lon + 0.0005),
                    m.ThermalObservation.acquired_at == acq,
                )
                .limit(1)
            ).scalar_one_or_none()

            if db_dup is not None:
                dup_count += 1
                _seen.add(mem_key)
                continue

            _seen.add(mem_key)

            # 3. Process into PostGIS geometry + event enrichment + ML classification pipeline
            try:
                event_service.process_event(o, db, data_mode=data_mode)
                ingested_count += 1
            except Exception as e:  # noqa: BLE001
                error_count += 1
                log.warning("Ingestion event processing failed at (%s, %s): %s", lat, lon, e)

        db.commit()

    log.info(
        "FIRMS poll summary: fetched=%s ingested=%s duplicates_skipped=%s errors=%s",
        len(obs),
        ingested_count,
        dup_count,
        error_count,
    )
    return {
        "status": "completed",
        "fetched": len(obs),
        "ingested": ingested_count,
        "duplicates_skipped": dup_count,
        "errors": error_count,
    }
