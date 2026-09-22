"""Transparent operational-priority risk engine (NOT a disaster-probability model)."""
from __future__ import annotations

from typing import Any

from app.core.config import get_settings

DISCLAIMER = ("Operational priority score for triage only — not a probability of disaster, "
              "explosion, or certified hazard.")


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def calculate_risk(features: dict[str, Any], temporal: dict[str, Any] | None = None) -> dict[str, Any]:
    s = get_settings()
    frp = float(features.get("frp_mw") or 0.0)
    bright = float(features.get("brightness_k") or 300.0)
    thermal = _clip01(0.55 * min(frp / 80.0, 1.0) + 0.45 * min(max(bright - 300.0, 0.0) / 80.0, 1.0))

    obs = int(features.get("observation_count_7d") or 0)
    persist = float(features.get("persistence_hours_7d") or 0.0)
    persistence = _clip01(0.5 * min(obs / 15.0, 1.0) + 0.5 * min(persist / 72.0, 1.0))

    pop = float(features.get("population_5km") or 0.0)
    population = _clip01(min(pop / 30000.0, 1.0) ** 0.7)

    infra_d = min(float(features.get("industrial_proximity_km", 50)),
                  float(features.get("refinery_proximity_km", 50)))
    infra = _clip01(1.0 - min(infra_d / 30.0, 1.0))

    trend_raw = features.get("frp_trend_pct")
    try:
        trend_v = float(trend_raw) if trend_raw is not None else 0.0
    except (TypeError, ValueError):
        trend_v = 0.0
    trend = _clip01((max(trend_v, -50.0) + 50.0) / 150.0)  # rising intensity -> higher score

    conf = float(features.get("firms_confidence_pct") or 50.0) / 100.0
    # confidence slightly modulates thermal component, kept transparent
    thermal_adj = _clip01(thermal * (0.85 + 0.3 * conf))

    # Canonical 5-factor weighted formula (0-100):
    # 0.30 x Severity + 0.25 x Persistence + 0.20 x Exposure + 0.15 x Infrastructure + 0.10 x Growth Proxy
    parts = {
        "severity": round(thermal_adj * 30.0, 1),
        "persistence": round(persistence * 25.0, 1),
        "exposure": round(population * 20.0, 1),
        "infrastructure": round(infra * 15.0, 1),
        "trend": round(trend * 10.0, 1),
    }
    score = round(sum(parts.values()), 1)
    score = max(0.0, min(100.0, score))

    if score >= s.RISK_CRITICAL:
        level = "CRITICAL"
    elif score >= s.RISK_HIGH:
        level = "HIGH"
    elif score >= s.RISK_MODERATE:
        level = "MODERATE"
    else:
        level = "LOW"

    return {
        "risk_score": score,
        "risk_level": level,
        "factors": parts,
        "risk_engine_version": s.RISK_ENGINE_VERSION,
        "disclaimer": DISCLAIMER,
        "components_01": {
            "severity": thermal_adj,
            "persistence": persistence,
            "exposure": population,
            "infrastructure": infra,
            "growth_proxy": trend,
        },
    }
