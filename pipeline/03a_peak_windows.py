"""
Module M3 — Peak-Time Patrol Window Predictor

Owner: Prakhar — Classification, Geography & Ops Layer

Purpose:
    For each spatial cluster (excluding NOISE), compute the peak violation
    hour and derive a recommended 2-hour patrol window.  All temporal
    analysis is done on IST timestamps already present in the handoff file.

Inputs:
    data/processed/cluster_handoff_for_prakhar.parquet  — row-level with IST columns
    data/processed/cluster_summary.parquet              — cluster-level reference

Outputs:
    data/processed/cluster_peak_windows.parquet
    data/processed/cluster_peak_windows.csv

Schema of output (one row per real cluster_id):
    cluster_id, total_violations, active_days, active_weeks,
    peak_hour, peak_hour_count, peak_hour_share, top_3_hours,
    peak_day_name, peak_day_type, weekday_peak_hour, weekend_peak_hour,
    recommended_patrol_window, secondary_patrol_window,
    temporal_concentration_score, temporal_confidence, m3_notes

Temporal confidence rules (deterministic):
    HIGH   : total_violations >= 100  AND  active_days >= 14  AND
             temporal_concentration_score >= 0.25
    MEDIUM : total_violations >= 30   OR   active_days >= 7
             (and not already HIGH)
    LOW    : everything else (sparse data or flat hourly distribution)

Temporal concentration score:
    share of violations falling in the top-3 hours out of 24.
    Range [0, 1].  A uniform distribution gives ~0.125; heavily
    concentrated peaks give values close to 1.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
HANDOFF_PATH = ROOT / "data" / "processed" / "cluster_handoff_for_prakhar.parquet"
SUMMARY_PATH = ROOT / "data" / "processed" / "cluster_summary.parquet"
OUT_PARQUET = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
OUT_CSV = ROOT / "data" / "processed" / "cluster_peak_windows.csv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patrol_window(hour: int) -> str:
    """Return a human-readable 2-hour window starting at *hour* (0-23)."""
    end = (hour + 2) % 24
    return f"{hour:02d}:00-{end:02d}:00"


def _confidence(total_violations: int, active_days: int,
                concentration: float) -> str:
    """Deterministic three-tier confidence rating."""
    if total_violations >= 100 and active_days >= 14 and concentration >= 0.25:
        return "HIGH"
    if total_violations >= 30 or active_days >= 7:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def compute_peak_windows(
    handoff_path: Path = HANDOFF_PATH,
    summary_path: Path = SUMMARY_PATH,
) -> pd.DataFrame:
    """Return one-row-per-cluster DataFrame with M3 peak window metrics."""

    # ------------------------------------------------------------------
    # 1. Load
    # ------------------------------------------------------------------
    df = pd.read_parquet(handoff_path)
    summary = pd.read_parquet(summary_path)

    # ------------------------------------------------------------------
    # 2. Filter: keep only clustered rows (drop NOISE)
    # ------------------------------------------------------------------
    df = df[df["is_clustered"] == 1].copy()
    # Belt-and-suspenders: also drop any stray NOISE cluster_id
    df = df[df["cluster_id"] != "NOISE"].copy()

    # ------------------------------------------------------------------
    # 3. Per-cluster hourly counts (all days combined)
    # ------------------------------------------------------------------
    hour_counts = (
        df.groupby(["cluster_id", "hour"])
        .size()
        .rename("count")
        .reset_index()
    )

    # ------------------------------------------------------------------
    # 4. Per-cluster weekday-only and weekend-only hourly counts
    # ------------------------------------------------------------------
    df_wd = df[df["is_weekend"] == 0]
    df_we = df[df["is_weekend"] == 1]

    wd_peak = (
        df_wd.groupby(["cluster_id", "hour"])
        .size()
        .groupby(level="cluster_id")
        .idxmax()
        .apply(lambda x: x[1] if isinstance(x, tuple) else None)
        .rename("weekday_peak_hour")
    )
    we_peak = (
        df_we.groupby(["cluster_id", "hour"])
        .size()
        .groupby(level="cluster_id")
        .idxmax()
        .apply(lambda x: x[1] if isinstance(x, tuple) else None)
        .rename("weekend_peak_hour")
    )

    # ------------------------------------------------------------------
    # 5. Per-cluster daily-level counts (for peak day)
    # ------------------------------------------------------------------
    day_counts = (
        df.groupby(["cluster_id", "day_name"])
        .size()
        .rename("count")
        .reset_index()
    )

    # ------------------------------------------------------------------
    # 6. Assemble one row per cluster
    # ------------------------------------------------------------------
    records = []

    # Pull active_days / active_weeks from cluster_summary (pre-computed)
    summary_idx = summary.set_index("cluster_id")[["active_days", "active_weeks"]]

    # Group hour_counts by cluster
    hc_grouped = hour_counts.groupby("cluster_id")
    dc_grouped = day_counts.groupby("cluster_id")
    raw_grouped = df.groupby("cluster_id")

    for cid, hc in hc_grouped:
        hc_sorted = hc.sort_values("count", ascending=False)

        total_violations = int(hc["count"].sum())

        # active_days / active_weeks from summary; fall back to raw if missing
        if cid in summary_idx.index:
            active_days = int(summary_idx.loc[cid, "active_days"])
            active_weeks = int(summary_idx.loc[cid, "active_weeks"])
        else:
            raw_g = raw_grouped.get_group(cid)
            active_days = int(raw_g["date_ist"].nunique())
            active_weeks = int(raw_g["week_number"].nunique())

        # Peak hour (primary)
        peak_row = hc_sorted.iloc[0]
        peak_hour = int(peak_row["hour"])
        peak_hour_count = int(peak_row["count"])
        peak_hour_share = round(peak_hour_count / total_violations, 4) if total_violations else 0.0

        # Top 3 hours
        top3 = hc_sorted.head(3)["hour"].tolist()
        top_3_hours = json.dumps([int(h) for h in top3])

        # Secondary hour (second-best, for secondary window)
        if len(hc_sorted) >= 2:
            secondary_hour = int(hc_sorted.iloc[1]["hour"])
            secondary_window = _patrol_window(secondary_hour)
        else:
            secondary_hour = None
            secondary_window = None

        # Temporal concentration: share of violations in top-3 hours
        top3_count = int(hc_sorted.head(3)["count"].sum())
        temporal_concentration_score = round(top3_count / total_violations, 4) if total_violations else 0.0

        # Peak day
        if cid in dc_grouped.groups:
            dc = dc_grouped.get_group(cid)
            dc_sorted = dc.sort_values("count", ascending=False)
            peak_day_name = dc_sorted.iloc[0]["day_name"]
        else:
            peak_day_name = None

        # Peak day type
        weekends = {"Saturday", "Sunday"}
        weekdays_set = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

        raw_g = raw_grouped.get_group(cid)
        wd_viol = int((raw_g["is_weekend"] == 0).sum())
        we_viol = int((raw_g["is_weekend"] == 1).sum())
        wd_share = wd_viol / total_violations if total_violations else 0
        we_share = we_viol / total_violations if total_violations else 0

        # MIXED if neither weekday nor weekend dominates by > 65 %
        if wd_share >= 0.65:
            peak_day_type = "WEEKDAY"
        elif we_share >= 0.65:
            peak_day_type = "WEEKEND"
        else:
            peak_day_type = "MIXED"

        # Per-split peak hours
        wdph = int(wd_peak.loc[cid]) if cid in wd_peak.index else None
        weph = int(we_peak.loc[cid]) if cid in we_peak.index else None

        # Recommended window: use actual peak hour learned from data
        recommended_window = _patrol_window(peak_hour)

        # Temporal confidence
        confidence = _confidence(total_violations, active_days,
                                 temporal_concentration_score)

        # Notes
        notes_parts = []
        if total_violations < 30:
            notes_parts.append("sparse data (<30 violations)")
        if active_days < 7:
            notes_parts.append("few active days (<7)")
        if temporal_concentration_score < 0.15:
            notes_parts.append("flat hourly distribution (concentration<0.15)")
        if peak_day_type == "MIXED":
            notes_parts.append("no strong weekday/weekend skew")
        m3_notes = "; ".join(notes_parts) if notes_parts else "clean"

        records.append({
            "cluster_id": cid,
            "total_violations": total_violations,
            "active_days": active_days,
            "active_weeks": active_weeks,
            "peak_hour": peak_hour,
            "peak_hour_count": peak_hour_count,
            "peak_hour_share": peak_hour_share,
            "top_3_hours": top_3_hours,
            "peak_day_name": peak_day_name,
            "peak_day_type": peak_day_type,
            "weekday_peak_hour": wdph,
            "weekend_peak_hour": weph,
            "recommended_patrol_window": recommended_window,
            "secondary_patrol_window": secondary_window,
            "temporal_concentration_score": temporal_concentration_score,
            "temporal_confidence": confidence,
            "m3_notes": m3_notes,
        })

    result = pd.DataFrame(records)

    # Ensure correct types
    result["peak_hour"] = result["peak_hour"].astype(int)
    result["total_violations"] = result["total_violations"].astype(int)
    result["active_days"] = result["active_days"].astype(int)
    result["active_weeks"] = result["active_weeks"].astype(int)

    return result


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

def run(
    handoff_path: Path = HANDOFF_PATH,
    summary_path: Path = SUMMARY_PATH,
    out_parquet: Path = OUT_PARQUET,
    out_csv: Path = OUT_CSV,
) -> pd.DataFrame:
    result = compute_peak_windows(handoff_path, summary_path)
    result.to_parquet(out_parquet, index=False)
    result.to_csv(out_csv, index=False)
    return result


if __name__ == "__main__":
    df = run()
    print(f"M3 complete. {len(df)} clusters processed.")
    print(df[["cluster_id", "total_violations", "peak_hour",
              "recommended_patrol_window", "temporal_confidence"]].head(10).to_string())
