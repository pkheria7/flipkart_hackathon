"""
Module Merge — Prakhar Phase 2 Feature Handoff

Owner: Prakhar — Classification, Geography & Ops Layer

Purpose:
    Merge all Prakhar-side Phase 2 features (M3 peak windows, M18 jurisdiction
    scoping, M4 classification) into one clean, join-safe file for downstream
    use by Piyush's M2/M7/M1 scoring pipeline and the final dashboard.

    This module does NOT compute any new features.  It only joins, resolves
    column conflicts, and validates the result.

Inputs:
    data/processed/cluster_summary.parquet        — 1 row per cluster (base)
    data/processed/cluster_peak_windows.parquet   — M3 output
    data/processed/jurisdiction_clusters.parquet  — M18 output
    data/processed/cluster_classification.parquet — M4 output

Output:
    data/processed/prakhar_cluster_features.parquet
    data/processed/prakhar_cluster_features.csv

Canonical column source for shared fields:
    Columns that appear in multiple inputs are taken from the highest-fidelity
    source and silently dropped from the others before joining, preventing
    pandas _x/_y suffixes entirely.

    | Column              | Canonical source   |
    |---------------------|--------------------|
    | violation_count     | cluster_summary    |
    | active_days         | cluster_summary    |
    | active_weeks        | cluster_summary    |
    | centroid_lat/lng    | cluster_summary    |
    | police_station_mode | cluster_summary    |
    | cluster_quality     | cluster_summary    |
    | needs_manual_review | cluster_summary    |
    | dominant_vehicle_type| cluster_summary   |
    | junction_flag_rate  | cluster_summary    |
    | location_mode       | cluster_summary    |
    | peak_hour           | cluster_peak_windows (M3) |
    | peak_hour_share     | cluster_peak_windows (M3) |
    | temporal_concentration_score | cluster_peak_windows (M3) |
    | assigned_station    | jurisdiction_clusters (M18) |
    | station_priority_band| jurisdiction_clusters (M18) |
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT              = Path(__file__).resolve().parent.parent
SUMMARY_PATH      = ROOT / "data" / "processed" / "cluster_summary.parquet"
PEAK_WIN_PATH     = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
JURISDICTION_PATH = ROOT / "data" / "processed" / "jurisdiction_clusters.parquet"
CLASSIF_PATH      = ROOT / "data" / "processed" / "cluster_classification.parquet"
OUT_PARQUET       = ROOT / "data" / "processed" / "prakhar_cluster_features.parquet"
OUT_CSV           = ROOT / "data" / "processed" / "prakhar_cluster_features.csv"

FEATURE_VERSION   = "PRAKHAR_PHASE2_MERGE_V1"

# ---------------------------------------------------------------------------
# Exact column lists to pull from each source (after stripping duplicates)
# ---------------------------------------------------------------------------

# From cluster_summary — the base (all columns kept)
_SUMMARY_COLS = [
    "cluster_id", "centroid_lat", "centroid_lng", "violation_count",
    "unique_vehicle_types", "dominant_vehicle_type", "vehicle_mix",
    "police_station_mode", "location_mode", "junction_name_mode",
    "junction_flag_rate", "has_junction_name_rate",
    "first_seen_ist", "last_seen_ist",
    "active_days", "active_weeks",
    "peak_hour_basic", "peak_day_basic", "h3_cells_count",
    "cluster_quality", "needs_manual_review",
]

# From cluster_peak_windows — M3-unique columns only
_M3_COLS = [
    "cluster_id",
    "peak_hour", "peak_hour_count", "peak_hour_share",
    "top_3_hours", "peak_day_name", "peak_day_type",
    "weekday_peak_hour", "weekend_peak_hour",
    "recommended_patrol_window", "secondary_patrol_window",
    "temporal_concentration_score", "temporal_confidence", "m3_notes",
]

# From jurisdiction_clusters — M18-unique columns only
_M18_COLS = [
    "cluster_id",
    "assigned_station", "station_assignment_method", "station_assignment_confidence",
    "station_cluster_rank", "station_violation_rank", "station_priority_band",
    "is_top_station_hotspot", "station_total_clusters", "station_total_violations",
    "station_needs_review_clusters", "station_good_clusters", "station_medium_clusters",
    "cluster_violation_share_within_station", "jurisdiction_notes",
]

# From cluster_classification — M4-unique columns only
_M4_COLS = [
    "cluster_id",
    "observation_span_days", "recurrence_rate_days", "week_coverage_rate",
    "avg_violations_per_active_day", "max_daily_violations", "top_day_share",
    "weekend_share", "weekday_share",
    "hotspot_type", "needs_review_flag", "deployment_readiness", "review_reason",
    "primary_behavior_signal", "behavior_signal_strength",
    "recommended_action", "classification_confidence", "m4_reason", "m4_notes",
]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate(df: pd.DataFrame, summary: pd.DataFrame) -> list[tuple[str, bool, str]]:
    """
    Return list of (check_name, passed, detail) tuples.
    Raises ValueError on critical failures before writing.
    """
    expected_ids = set(summary["cluster_id"])
    actual_ids   = set(df["cluster_id"])
    total_viol_summary = int(summary["violation_count"].sum())
    total_viol_output  = int(df["violation_count"].sum())

    suffix_cols = [c for c in df.columns if c.endswith("_x") or c.endswith("_y")]

    checks = [
        ("one_row_per_cluster_summary",
         len(df) == len(summary),
         f"output={len(df)}, summary={len(summary)}"),
        ("cluster_id_unique",
         df["cluster_id"].nunique() == len(df),
         f"unique={df['cluster_id'].nunique()}, rows={len(df)}"),
        ("no_noise_rows",
         "NOISE" not in actual_ids,
         "NOISE" if "NOISE" in actual_ids else "clean"),
        ("cluster_ids_unchanged",
         expected_ids == actual_ids,
         f"symmetric diff={expected_ids ^ actual_ids}" if expected_ids != actual_ids else "match"),
        ("m3_join_100pct",
         df["recommended_patrol_window"].notna().all(),
         f"null count={df['recommended_patrol_window'].isna().sum()}"),
        ("m18_join_100pct",
         df["assigned_station"].notna().all(),
         f"null count={df['assigned_station'].isna().sum()}"),
        ("m4_join_100pct",
         df["hotspot_type"].notna().all(),
         f"null count={df['hotspot_type'].isna().sum()}"),
        ("assigned_station_non_null",
         df["assigned_station"].notna().all(),
         f"null count={df['assigned_station'].isna().sum()}"),
        ("hotspot_type_non_null",
         df["hotspot_type"].notna().all(),
         f"null count={df['hotspot_type'].isna().sum()}"),
        ("hotspot_type_valid_values",
         set(df["hotspot_type"].dropna().unique()).issubset(
             {"STRUCTURAL", "RESPONSIVE", "SEASONAL"}),
         f"found={set(df['hotspot_type'].unique())}"),
        ("deployment_readiness_valid",
         set(df["deployment_readiness"].dropna().unique()).issubset(
             {"READY", "REVIEW_FIRST"}),
         f"found={set(df['deployment_readiness'].unique())}"),
        ("recommended_patrol_window_non_null",
         df["recommended_patrol_window"].notna().all(),
         f"null count={df['recommended_patrol_window'].isna().sum()}"),
        ("recommended_action_non_null",
         df["recommended_action"].notna().all(),
         f"null count={df['recommended_action'].isna().sum()}"),
        ("station_priority_band_non_null",
         df["station_priority_band"].notna().all(),
         f"null count={df['station_priority_band'].isna().sum()}"),
        ("no_suffix_columns",
         len(suffix_cols) == 0,
         f"found={suffix_cols}" if suffix_cols else "clean"),
        ("violation_totals_unchanged",
         total_viol_summary == total_viol_output,
         f"summary={total_viol_summary}, output={total_viol_output}"),
    ]

    # Raise on critical failures
    critical = {
        "cluster_id_unique", "no_noise_rows", "cluster_ids_unchanged",
        "no_suffix_columns", "violation_totals_unchanged",
        "hotspot_type_valid_values", "deployment_readiness_valid",
    }
    for name, passed, detail in checks:
        if not passed and name in critical:
            raise ValueError(f"Critical validation failed [{name}]: {detail}")

    return checks


# ---------------------------------------------------------------------------
# Core merge
# ---------------------------------------------------------------------------

def compute_merge(
    summary_path: Path      = SUMMARY_PATH,
    peak_win_path: Path     = PEAK_WIN_PATH,
    jurisdiction_path: Path = JURISDICTION_PATH,
    classif_path: Path      = CLASSIF_PATH,
) -> tuple[pd.DataFrame, list[tuple[str, bool, str]]]:
    """
    Return (merged_df, validation_checks).
    Raises ValueError if any critical check fails.
    """

    # ------------------------------------------------------------------
    # 1. Load inputs, selecting only the designated columns from each
    # ------------------------------------------------------------------
    summary = pd.read_parquet(summary_path)
    # Keep only known summary cols that exist (future-proof)
    summary = summary[[c for c in _SUMMARY_COLS if c in summary.columns]].copy()

    pw  = pd.read_parquet(peak_win_path)
    pw  = pw[[c for c in _M3_COLS if c in pw.columns]].copy()

    jc  = pd.read_parquet(jurisdiction_path)
    jc  = jc[[c for c in _M18_COLS if c in jc.columns]].copy()

    cl  = pd.read_parquet(classif_path)
    cl  = cl[[c for c in _M4_COLS if c in cl.columns]].copy()

    # ------------------------------------------------------------------
    # 2. Left-join in sequence on cluster_id
    # ------------------------------------------------------------------
    merged = (
        summary
        .merge(pw, on="cluster_id", how="left")
        .merge(jc, on="cluster_id", how="left")
        .merge(cl, on="cluster_id", how="left")
    )

    # Belt-and-suspenders: confirm no suffix columns leaked through
    suffix_leaked = [c for c in merged.columns if c.endswith("_x") or c.endswith("_y")]
    if suffix_leaked:
        raise ValueError(
            f"Suffix columns found after merge: {suffix_leaked}. "
            "Check _M3_COLS / _M18_COLS / _M4_COLS for missed overlap."
        )

    # Exclude any stray NOISE rows
    merged = merged[merged["cluster_id"] != "NOISE"].copy()

    # ------------------------------------------------------------------
    # 3. Add handoff helper columns
    # ------------------------------------------------------------------
    has_m3  = merged["recommended_patrol_window"].notna()
    has_m18 = merged["assigned_station"].notna()
    has_m4  = merged["hotspot_type"].notna()

    merged["handoff_ready"]  = (has_m3 & has_m18 & has_m4)
    merged["handoff_warning"] = merged.apply(
        lambda row: "OK" if (
            pd.notna(row.get("recommended_patrol_window")) and
            pd.notna(row.get("assigned_station")) and
            pd.notna(row.get("hotspot_type"))
        ) else (
            "; ".join(
                f for f, ok in [
                    ("M3 patrol window missing", pd.isna(row.get("recommended_patrol_window"))),
                    ("M18 station missing",      pd.isna(row.get("assigned_station"))),
                    ("M4 hotspot_type missing",  pd.isna(row.get("hotspot_type"))),
                ]
                if ok
            )
        ),
        axis=1,
    )
    merged["prakhar_feature_version"] = FEATURE_VERSION
    merged["downstream_join_key"]     = merged["cluster_id"]

    # ------------------------------------------------------------------
    # 4. Validate
    # ------------------------------------------------------------------
    checks = _validate(merged, summary)

    return merged, checks


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

def run(
    summary_path: Path      = SUMMARY_PATH,
    peak_win_path: Path     = PEAK_WIN_PATH,
    jurisdiction_path: Path = JURISDICTION_PATH,
    classif_path: Path      = CLASSIF_PATH,
    out_parquet: Path       = OUT_PARQUET,
    out_csv: Path           = OUT_CSV,
) -> tuple[pd.DataFrame, list[tuple[str, bool, str]]]:
    merged, checks = compute_merge(
        summary_path, peak_win_path, jurisdiction_path, classif_path
    )
    merged.to_parquet(out_parquet, index=False)
    merged.to_csv(out_csv, index=False)
    return merged, checks


if __name__ == "__main__":
    df, checks = run()
    print(f"Merge complete. {len(df)} clusters, {len(df.columns)} columns.")
    print(df["hotspot_type"].value_counts().to_string())
    print(df["deployment_readiness"].value_counts().to_string())
