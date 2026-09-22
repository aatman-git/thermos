"""Server-side aggregations for analytics endpoints."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import models as m


def summary(db: Session) -> dict:
    total = db.scalar(select(func.count(m.ThermalEvent.id))) or 0
    by_class = dict(db.execute(select(m.ThermalEvent.current_classification, func.count()).group_by(m.ThermalEvent.current_classification)).all())
    by_risk = dict(db.execute(select(m.ThermalEvent.risk_level, func.count()).group_by(m.ThermalEvent.risk_level)).all())
    high = sum(v for k, v in by_risk.items() if k in ("HIGH", "CRITICAL"))
    crit = by_risk.get("CRITICAL", 0)
    avg_frp = None
    frps = [r[0] for r in db.execute(select(m.ThermalObservation.frp_mw).where(m.ThermalObservation.frp_mw.isnot(None))).all()]
    if frps:
        avg_frp = round(sum(frps) / len(frps), 2)
    confs = [r[0] for r in db.execute(select(m.ThermalEvent.classification_confidence).where(m.ThermalEvent.classification_confidence.isnot(None))).all()]
    conf_hist = {"0-50": 0, "50-70": 0, "70-85": 0, "85-100": 0}
    for c in confs:
        c100 = c * 100 if c <= 1 else c
        if c100 < 50:
            conf_hist["0-50"] += 1
        elif c100 < 70:
            conf_hist["50-70"] += 1
        elif c100 < 85:
            conf_hist["70-85"] += 1
        else:
            conf_hist["85-100"] += 1
    return {"total_events": total, "by_class": by_class, "by_risk": by_risk,
            "high_risk_count": high, "critical_count": crit, "avg_frp_mw": avg_frp,
            "confidence_distribution": conf_hist,
            "disclaimer": "Development data may be synthetic; metrics describe the stored dataset, not real-world accuracy."}


def timeseries(db: Session, days: int = 30) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.execute(select(m.ThermalEvent.first_detected_at).where(m.ThermalEvent.first_detected_at >= cutoff)).all()
    c = Counter((r[0].date().isoformat() if isinstance(r[0], datetime) else str(r[0])[:10]) for r in rows if r[0])
    return [{"date": d, "count": n} for d, n in sorted(c.items())][-days:]


def classifications(db: Session) -> list[dict]:
    rows = db.execute(select(m.ThermalEvent.current_classification, func.count()).group_by(m.ThermalEvent.current_classification)).all()
    return [{"class": k or "Unknown", "count": v} for k, v in rows]


def risk_distribution(db: Session) -> list[dict]:
    rows = db.execute(select(m.ThermalEvent.risk_level, func.count()).group_by(m.ThermalEvent.risk_level)).all()
    return [{"level": k or "Unknown", "count": v} for k, v in rows]


def regions(db: Session, grid: float = 2.0) -> list[dict]:
    """Coarse lat/lon grid counts (server-side aggregation, no raw dump)."""
    rows = db.execute(select(m.ThermalEvent.latitude, m.ThermalEvent.longitude, m.ThermalEvent.risk_level)
                      .order_by(m.ThermalEvent.last_detected_at.desc()).limit(5000)).all()
    cells: Counter = Counter()
    for lat, lon, risk in rows:
        cells[(round(lat / grid) * grid, round(lon / grid) * grid)] += 1
    return [{"lat": k[0], "lon": k[1], "count": v} for k, v in cells.most_common(50)]
