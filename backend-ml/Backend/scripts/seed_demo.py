"""Seed curated realistic demo scenarios for judging/offline presentations.
Scenarios:
1. Industrial Persistent Flare (Jamnagar Refinery)
2. Industrial Accidental Fire (Dahej Chemical Zone)
3. Wildfire (Similipal Forest Range)
4. Agricultural Stubble Burning (Punjab Cropland)
5. Unknown / Marginal Anomaly (Remote Desert Perimeter)
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import setup_logging
from app.db import models as m
from app.db.database import Base, SessionLocal, engine
from app.services import audit_service, event_service

setup_logging("INFO")

DEMO_SCENARIOS = [
    {
        "key": "industrial_flare",
        "title": "Industrial Persistent Gas Flare (Jamnagar)",
        "latitude": 22.4707,
        "longitude": 70.0577,
        "brightness_k": 348.5,
        "frp_mw": 24.2,
        "confidence": "h",
        "daynight": "N",
        "source": "VIIRS",
        "expected_class": "Gas Flare",
        "target_status": "ACKNOWLEDGED",
    },
    {
        "key": "industrial_accidental_fire",
        "title": "Industrial Accidental Fire Outbreak (Dahej SEZ)",
        "latitude": 21.7125,
        "longitude": 72.5842,
        "brightness_k": 395.2,
        "frp_mw": 142.8,
        "confidence": "h",
        "daynight": "N",
        "source": "VIIRS",
        "expected_class": "Industrial Fire",
        "target_status": "ALERTED",
    },
    {
        "key": "wildfire_forest",
        "title": "Wildfire Outbreak (Similipal Biosphere Reserve)",
        "latitude": 21.9056,
        "longitude": 86.3417,
        "brightness_k": 368.0,
        "frp_mw": 82.5,
        "confidence": "h",
        "daynight": "D",
        "source": "MODIS",
        "expected_class": "Wildfire",
        "target_status": "EN_ROUTE",
    },
    {
        "key": "agricultural_stubble",
        "title": "Agricultural Stubble Burning (Sangrur, Punjab)",
        "latitude": 30.2458,
        "longitude": 75.8421,
        "brightness_k": 318.4,
        "frp_mw": 11.6,
        "confidence": "n",
        "daynight": "D",
        "source": "VIIRS",
        "expected_class": "Agricultural Burning",
        "target_status": "RESOLVED",
    },
    {
        "key": "unknown_anomaly",
        "title": "Unclassified Thermal Anomaly (Barmer Desert)",
        "latitude": 26.2145,
        "longitude": 71.3250,
        "brightness_k": 305.2,
        "frp_mw": 3.8,
        "confidence": "l",
        "daynight": "D",
        "source": "VIIRS",
        "expected_class": "Unknown / Unclassified",
        "target_status": "ASSESSED",
    },
]


def seed_curated_scenarios() -> list[str]:
    Base.metadata.create_all(bind=engine)
    created_ids = []

    with SessionLocal() as db:
        for scen in DEMO_SCENARIOS:
            now = datetime.now(timezone.utc)
            obs = {
                "latitude": scen["latitude"],
                "longitude": scen["longitude"],
                "brightness_k": scen["brightness_k"],
                "frp_mw": scen["frp_mw"],
                "confidence": scen["confidence"],
                "daynight": scen["daynight"],
                "source": scen["source"],
                "acquired_at": (now - timedelta(hours=2)).isoformat(),
            }

            res = event_service.process_event(obs, db, data_mode="demo")
            eid = res["event"]["id"]
            ev = db.get(m.ThermalEvent, eid)

            if scen["key"] == "unknown_anomaly":
                ev.current_classification = "Unknown"
                ev.classification_confidence = 0.38
                pred = db.query(m.Prediction).filter_by(event_id=eid).first()
                if pred:
                    pred.predicted_class = "Unknown"
                    pred.low_margin = True
                    pred.needs_review = True

            # Set requested operational status and record audit log
            from_st = ev.status
            ev.status = scen["target_status"]
            db.commit()

            audit_service.log_incident_action(
                db,
                event_id=eid,
                action="DEMO_SEED",
                from_status=from_st,
                to_status=scen["target_status"],
                user_id="seed_script",
                user_role="Admin",
                details={
                    "scenario": scen["title"],
                    "risk_score": ev.risk_score,
                    "classification": ev.current_classification,
                },
            )

            created_ids.append(eid)
            print(f"[*] Seeded: {scen['title']} -> ID: {eid} | Status: {ev.status} | Risk: {ev.risk_score}")

    return created_ids


if __name__ == "__main__":
    ids = seed_curated_scenarios()
    print(f"\n[+] Successfully seeded {len(ids)} curated offline demo scenarios.")
