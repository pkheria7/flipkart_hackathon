"""
Module M18 — Jurisdiction-Aware Allocation (Backend Half)

Owner: Prakhar — Classification, Geography & Ops Layer

Purpose:
    Assign each hotspot cluster to a police station, rank clusters within each
    station by violation burden, compute station-level workload summaries, and
    flag top-priority hotspots for each station.

    Assignment method: police_station_mode (observed FTVR field).
    No geopandas / polygon boundary computation is performed here.
    This is "FTVR-observed jurisdiction", not official legal boundary mapping.

Inputs:
    data/processed/cluster_summary.parquet        — cluster-level reference
    data/processed/cluster_peak_windows.parquet   — M3 output (optional enrichment)

Outputs:
    data/processed/jurisdiction_clusters.parquet
    data/processed/jurisdiction_clusters.csv
    data/processed/station_workload_summary.parquet
    data/processed/station_workload_summary.csv

Station assignment confidence rules (deterministic):
    HIGH   : police_station_mode is non-null AND cluster_quality in {'good','medium'}
             AND needs_manual_review == 0
    MEDIUM : police_station_mode is non-null AND (cluster_quality == 'needs_review'
             OR needs_manual_review == 1)
    LOW    : police_station_mode is null or empty

Station priority band (station-level, based on total violations across all stations):
    CRITICAL : station_total_violations >= 90th percentile across all stations  (≥ ~12,800)
    HIGH     : >= 75th percentile  (≥ ~4,500)
    MEDIUM   : >= 50th percentile  (≥ ~2,400)
    LOW      : below median

Top-station hotspot rule per station:
    is_top_station_hotspot = True for the top N clusters ranked by violation_count,
    where N = min(10, max(3, floor(station_total_clusters * 0.20))).
    i.e. at most top-10, at least 3, otherwise top-20% of the station's clusters.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
SUMMARY_PATH = ROOT / "data" / "processed" / "cluster_summary.parquet"
PEAK_WINDOWS_PATH = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
OUT_CLUSTERS_PARQUET = ROOT / "data" / "processed" / "jurisdiction_clusters.parquet"
OUT_CLUSTERS_CSV = ROOT / "data" / "processed" / "jurisdiction_clusters.csv"
OUT_STATION_PARQUET = ROOT / "data" / "processed" / "station_workload_summary.parquet"
OUT_STATION_CSV = ROOT / "data" / "processed" / "station_workload_summary.csv"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assignment_confidence(row: pd.Series) -> str:
    station = row.get("police_station_mode", None)
    if not station or (isinstance(station, float) and math.isnan(station)):
        return "LOW"
    quality = row.get("cluster_quality", "")
    needs_review = row.get("needs_manual_review", 1)
    if quality in ("good", "medium") and needs_review == 0:
        return "HIGH"
    return "MEDIUM"


def _station_priority_band(total_violations: int,
                           p90: float, p75: float, p50: float) -> str:
    if total_violations >= p90:
        return "CRITICAL"
    if total_violations >= p75:
        return "HIGH"
    if total_violations >= p50:
        return "MEDIUM"
    return "LOW"


def _top_n_threshold(cluster_count: int) -> int:
    """Number of clusters to flag as top-hotspot within a station."""
    return min(10, max(3, math.floor(cluster_count * 0.20)))


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

def compute_jurisdiction(
    summary_path: Path = SUMMARY_PATH,
    peak_windows_path: Path = PEAK_WINDOWS_PATH,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Returns (jurisdiction_clusters_df, station_workload_df).
    """

    # ------------------------------------------------------------------
    # 1. Load inputs
    # ------------------------------------------------------------------
    summary = pd.read_parquet(summary_path)

    pw = None
    if peak_windows_path.exists():
        pw = pd.read_parquet(peak_windows_path)[
            ["cluster_id", "recommended_patrol_window", "temporal_confidence",
             "peak_hour", "peak_day_type"]
        ]

    # ------------------------------------------------------------------
    # 2. Assign station and confidence
    # ------------------------------------------------------------------
    df = summary.copy()

    df["assigned_station"] = df["police_station_mode"].fillna("UNKNOWN")
    df["station_assignment_method"] = "police_station_mode"
    df["station_assignment_confidence"] = df.apply(_assignment_confidence, axis=1)

    # ------------------------------------------------------------------
    # 3. Station-level aggregates
    # ------------------------------------------------------------------
    station_agg = (
        df.groupby("assigned_station")
        .agg(
            station_total_clusters=("cluster_id", "count"),
            station_total_violations=("violation_count", "sum"),
            station_needs_review_clusters=("needs_manual_review",
                                           lambda x: (x == 1).sum()),
            station_good_clusters=("cluster_quality",
                                   lambda x: (x == "good").sum()),
            station_medium_clusters=("cluster_quality",
                                     lambda x: (x == "medium").sum()),
        )
        .reset_index()
    )

    # ------------------------------------------------------------------
    # 4. Priority bands (station-level quantiles)
    # ------------------------------------------------------------------
    viol_series = station_agg["station_total_violations"]
    p90 = float(viol_series.quantile(0.90))
    p75 = float(viol_series.quantile(0.75))
    p50 = float(viol_series.quantile(0.50))

    station_agg["station_priority_band"] = station_agg["station_total_violations"].apply(
        lambda v: _station_priority_band(v, p90, p75, p50)
    )
    station_agg["station_rank_by_violations"] = (
        station_agg["station_total_violations"]
        .rank(method="min", ascending=False)
        .astype(int)
    )

    # ------------------------------------------------------------------
    # 5. Merge station aggregates back onto cluster-level df
    # ------------------------------------------------------------------
    df = df.merge(station_agg, on="assigned_station", how="left")

    # ------------------------------------------------------------------
    # 6. Per-cluster ranks within station
    # ------------------------------------------------------------------
    df["station_cluster_rank"] = (
        df.groupby("assigned_station")["violation_count"]
        .rank(method="min", ascending=False)
        .astype(int)
    )
    df["station_violation_rank"] = df["station_cluster_rank"]  # same metric

    # ------------------------------------------------------------------
    # 7. violation share within station
    # ------------------------------------------------------------------
    df["cluster_violation_share_within_station"] = (
        df["violation_count"] / df["station_total_violations"]
    ).round(4)

    # ------------------------------------------------------------------
    # 8. is_top_station_hotspot
    # ------------------------------------------------------------------
    def flag_top(grp: pd.DataFrame) -> pd.Series:
        n = _top_n_threshold(len(grp))
        return (grp["station_cluster_rank"] <= n).astype(int)

    df["is_top_station_hotspot"] = (
        df.groupby("assigned_station", group_keys=False)
        .apply(flag_top)
    )

    # ------------------------------------------------------------------
    # 9. Priority band at cluster level (inherited from station)
    # ------------------------------------------------------------------
    df["station_priority_band"] = df["assigned_station"].map(
        station_agg.set_index("assigned_station")["station_priority_band"]
    )

    # ------------------------------------------------------------------
    # 10. Jurisdiction notes
    # ------------------------------------------------------------------
    def _notes(row: pd.Series) -> str:
        parts = []
        if row["station_assignment_confidence"] == "LOW":
            parts.append("station unknown — manual review required")
        if row.get("needs_manual_review", 0) == 1:
            parts.append("cluster flagged for review")
        if row.get("cluster_quality", "") == "needs_review":
            parts.append("cluster quality: needs_review")
        share = row.get("cluster_violation_share_within_station", 0)
        if share >= 0.30:
            parts.append(f"dominates station ({share:.0%} of station violations)")
        return "; ".join(parts) if parts else "clean"

    df["jurisdiction_notes"] = df.apply(_notes, axis=1)

    # ------------------------------------------------------------------
    # 11. Select final cluster-level columns (keep originals + new)
    # ------------------------------------------------------------------
    keep_cols = [
        "cluster_id", "assigned_station", "station_assignment_method",
        "station_assignment_confidence", "station_cluster_rank",
        "station_violation_rank", "station_priority_band",
        "is_top_station_hotspot", "station_total_clusters",
        "station_total_violations", "station_needs_review_clusters",
        "station_good_clusters", "station_medium_clusters",
        "cluster_violation_share_within_station", "jurisdiction_notes",
        # original passthrough columns
        "violation_count", "centroid_lat", "centroid_lng",
        "police_station_mode", "cluster_quality", "needs_manual_review",
        "dominant_vehicle_type", "junction_flag_rate", "location_mode",
    ]
    jurisdiction_df = df[[c for c in keep_cols if c in df.columns]].copy()

    # ------------------------------------------------------------------
    # 12. Station workload summary
    # ------------------------------------------------------------------
    # top cluster per station
    top_cluster = (
        df.sort_values("violation_count", ascending=False)
        .groupby("assigned_station")
        .first()[["cluster_id", "violation_count"]]
        .rename(columns={"cluster_id": "top_cluster_id",
                         "violation_count": "top_cluster_violations"})
    )

    station_extras = (
        df.groupby("assigned_station")
        .agg(
            station_avg_cluster_size=("violation_count", "mean"),
            station_max_cluster_size=("violation_count", "max"),
            station_top_hotspot_count=("is_top_station_hotspot", "sum"),
        )
        .round({"station_avg_cluster_size": 1})
    )

    workload = (
        station_agg
        .set_index("assigned_station")
        .join(top_cluster)
        .join(station_extras)
        .reset_index()
    )

    # Join M3 peak window for top cluster
    if pw is not None:
        pw_top = pw[["cluster_id", "recommended_patrol_window"]].rename(
            columns={"cluster_id": "top_cluster_id",
                     "recommended_patrol_window": "top_cluster_peak_window"}
        )
        workload = workload.merge(pw_top, on="top_cluster_id", how="left")
    else:
        workload["top_cluster_peak_window"] = None

    # Workload notes
    def _workload_notes(row: pd.Series) -> str:
        parts = []
        if row["station_needs_review_clusters"] > 0:
            parts.append(
                f"{int(row['station_needs_review_clusters'])} clusters need manual review"
            )
        share = row["station_max_cluster_size"] / max(row["station_total_violations"], 1)
        if share >= 0.40:
            parts.append("one cluster dominates station (≥40% of violations)")
        return "; ".join(parts) if parts else "clean"

    workload["workload_notes"] = workload.apply(_workload_notes, axis=1)

    workload_cols = [
        "assigned_station", "station_total_clusters", "station_total_violations",
        "station_needs_review_clusters", "station_good_clusters",
        "station_medium_clusters", "station_top_hotspot_count",
        "station_avg_cluster_size", "station_max_cluster_size",
        "station_priority_band", "station_rank_by_violations",
        "top_cluster_id", "top_cluster_violations",
        "top_cluster_peak_window", "workload_notes",
    ]
    workload_df = workload[[c for c in workload_cols if c in workload.columns]].copy()

    return jurisdiction_df, workload_df


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

def run(
    summary_path: Path = SUMMARY_PATH,
    peak_windows_path: Path = PEAK_WINDOWS_PATH,
    out_clusters_parquet: Path = OUT_CLUSTERS_PARQUET,
    out_clusters_csv: Path = OUT_CLUSTERS_CSV,
    out_station_parquet: Path = OUT_STATION_PARQUET,
    out_station_csv: Path = OUT_STATION_CSV,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    jdf, wdf = compute_jurisdiction(summary_path, peak_windows_path)
    jdf.to_parquet(out_clusters_parquet, index=False)
    jdf.to_csv(out_clusters_csv, index=False)
    wdf.to_parquet(out_station_parquet, index=False)
    wdf.to_csv(out_station_csv, index=False)
    return jdf, wdf


if __name__ == "__main__":
    jdf, wdf = run()
    print(f"M18 complete. {len(jdf)} clusters, {len(wdf)} stations.")
    print(wdf.sort_values("station_rank_by_violations").head(10)[
        ["assigned_station", "station_total_violations",
         "station_total_clusters", "station_priority_band"]
    ].to_string(index=False))
