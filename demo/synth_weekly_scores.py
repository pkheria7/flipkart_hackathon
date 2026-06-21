"""
Generate synthetic weekly scored_hotspots for the 2-week demo.

This module creates Week 1 and Week 2 variants of `scored_hotspots.parquet`
by perturbing the real historical output. It does NOT re-run the full
pipeline; it simulates what the pipeline would produce with fresh weekly data.
All synthetic rows are tagged with `source = 'synthetic_demo'`.

In production, the agent would run the full pipeline on real data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REAL_SCORED = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
SYNTH_DIR = PROJECT_ROOT / "data" / "outputs" / "synthetic_demo"

np.random.seed(42)


def load_real_scored() -> pd.DataFrame:
    return pd.read_parquet(REAL_SCORED).copy()


def generate_week_1(scored: pd.DataFrame | None = None) -> pd.DataFrame:
    """Generate Week 1 synthetic scored hotspots."""
    if scored is None:
        scored = load_real_scored()

    df = scored.copy()
    df["source"] = "synthetic_demo"
    df["week"] = 1

    # Jitter violation counts by ±20%
    noise = np.random.uniform(0.8, 1.2, size=len(df))
    df["violation_count"] = (df["violation_count"] * noise).round().astype(int).clip(1, None)

    # Jitter persistence proportionally
    df["persistence"] = df["persistence"] * noise

    # Recurrence stays similar (based on active weeks)
    df["recurrence"] = df["recurrence"].clip(0, 1)

    # Recompute raw ROI proxy and percentile-rank again.
    # road_traffic_weight is not in the scored_hotspots schema, so we use
    # lcle_pct, persistence, bci, and recurrence.
    df["raw_roi"] = (
        df["lcle_pct"] * df["persistence"] * df["bci"] * df["recurrence"]
    )
    df["roi_score"] = (df["raw_roi"].rank(pct=True, method="average") * 100.0).round(4)

    df.drop(columns=["raw_roi"], inplace=True, errors="ignore")

    SYNTH_DIR.mkdir(parents=True, exist_ok=True)
    path = SYNTH_DIR / "week_1_scored_hotspots.parquet"
    df.to_parquet(path, index=False)
    print(f"[demo] Generated Week 1 synthetic scored hotspots: {path}")
    return df


def generate_week_2(week_1: pd.DataFrame, feedback_events: pd.DataFrame) -> pd.DataFrame:
    """
    Generate Week 2 synthetic scored hotspots based on Week 1 feedback.

    - Clusters marked 'resolved' in Week 1 see reduced violations.
    - Clusters marked 'recurred' see similar or slightly increased violations.
    - Unpatrolled clusters stay near Week 1 levels.
    """
    df = week_1.copy()
    df["source"] = "synthetic_demo"
    df["week"] = 2

    resolved_ids = set()
    recurred_ids = set()

    if not feedback_events.empty and "outcome" in feedback_events.columns:
        resolved_ids = set(feedback_events[feedback_events["outcome"] == "resolved"]["cluster_id"])
        recurred_ids = set(feedback_events[feedback_events["outcome"] == "recurred"]["cluster_id"])

    # Apply Week 2 adjustments
    for cid in resolved_ids:
        mask = df["cluster_id"] == cid
        if mask.any():
            df.loc[mask, "violation_count"] = (df.loc[mask, "violation_count"] * np.random.uniform(0.5, 0.7)).round().astype(int)
            df.loc[mask, "persistence"] *= np.random.uniform(0.5, 0.7)

    for cid in recurred_ids:
        mask = df["cluster_id"] == cid
        if mask.any():
            df.loc[mask, "violation_count"] = (df.loc[mask, "violation_count"] * np.random.uniform(1.0, 1.2)).round().astype(int)
            df.loc[mask, "persistence"] *= np.random.uniform(1.0, 1.2)

    # Re-rank ROI
    df["raw_roi"] = (
        df["lcle_pct"] * df["persistence"] * df["bci"] * df["recurrence"]
    )
    df["roi_score"] = (df["raw_roi"].rank(pct=True, method="average") * 100.0).round(4)
    df.drop(columns=["raw_roi"], inplace=True, errors="ignore")

    # Escalate recurred clusters to STRUCTURAL
    for cid in recurred_ids:
        mask = df["cluster_id"] == cid
        if mask.any():
            df.loc[mask, "classification"] = "STRUCTURAL"
            df.loc[mask, "recommended_action"] = "Recurring patrol + towing support + signage/infra review"

    path = SYNTH_DIR / "week_2_scored_hotspots.parquet"
    df.to_parquet(path, index=False)
    print(f"[demo] Generated Week 2 synthetic scored hotspots: {path}")
    return df


if __name__ == "__main__":
    w1 = generate_week_1()
    print(f"Week 1 total violations: {w1['violation_count'].sum():,}")
