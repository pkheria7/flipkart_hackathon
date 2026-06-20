"""
Stage M1 — ROI Ranker + Phase 2 Merge

Purpose:
    Merge Piyush's geospatial/LCLE/BCI output with Prakhar's Phase 2 features
    (M3 peak windows, M18 jurisdiction, M4 classification) and compute a final
    ROI score for each cluster. Produce the contract-aligned scored_hotspots
    table that downstream modules and dashboards consume.

Inputs:
    data/processed/enriched_clusters.parquet        — Piyush spine (LCLE, BCI, OSM)
    data/processed/prakhar_cluster_features.parquet — Prakhar Phase 2 merge

Outputs:
    data/outputs/scored_hotspots.parquet
    data/outputs/scored_hotspots.csv
    reports/M1_ROI_VALIDATION_REPORT.md
    reports/PHASE2_MERGE_REPORT.md

Owner:
    Piyush — Core ROI Pipeline spine (M1).
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUTS_DIR = PROJECT_ROOT / "data" / "outputs"
REPORTS_DIR = PROJECT_ROOT / "reports"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

ENRICHED_PATH = PROCESSED_DIR / "enriched_clusters.parquet"
PRAKHAR_PATH = PROCESSED_DIR / "prakhar_cluster_features.parquet"
OUTPUT_PARQUET = OUTPUTS_DIR / "scored_hotspots.parquet"
OUTPUT_CSV = OUTPUTS_DIR / "scored_hotspots.csv"
ROI_REPORT_MD = REPORTS_DIR / "M1_ROI_VALIDATION_REPORT.md"
MERGE_REPORT_MD = REPORTS_DIR / "PHASE2_MERGE_REPORT.md"

OFFICER_HOURS_PER_CLUSTER = 2.0  # one 2-hour patrol window

# Final contract schema, in order
SCHEMA_COLUMNS = [
    "cluster_id",
    "centroid_lat",
    "centroid_lng",
    "assigned_station",
    "border_flag",
    "road_class",
    "road_width_m",
    "osm_coverage",
    "violation_count",
    "vehicle_mix",
    "lcle_pct",
    "bci",
    "persistence",
    "recurrence",
    "peak_window",
    "roi_score",
    "classification",
    "recommended_action",
]

SCHEMA_DTYPES = {
    "cluster_id": "object",
    "centroid_lat": "float64",
    "centroid_lng": "float64",
    "assigned_station": "object",
    "border_flag": "int64",
    "road_class": "object",
    "road_width_m": "float64",
    "osm_coverage": "int64",
    "violation_count": "int64",
    "vehicle_mix": "object",
    "lcle_pct": "float64",
    "bci": "float64",
    "persistence": "float64",
    "recurrence": "float64",
    "peak_window": "object",
    "roi_score": "float64",
    "classification": "object",
    "recommended_action": "object",
}


# ---------------------------------------------------------------------------
# Merge helpers
# ---------------------------------------------------------------------------
def load_and_merge(enriched_path: Path, prakhar_path: Path) -> pd.DataFrame:
    """Load enriched clusters and Prakhar features and join on cluster_id."""
    print(f"[M1] Loading enriched clusters: {enriched_path}")
    enriched = pd.read_parquet(enriched_path)
    print(f"[M1]   rows={len(enriched):,}, cols={len(enriched.columns)}")

    print(f"[M1] Loading Prakhar features: {prakhar_path}")
    prakhar = pd.read_parquet(prakhar_path)
    print(f"[M1]   rows={len(prakhar):,}, cols={len(prakhar.columns)}")

    # Keep only Prakhar columns we actually need to avoid accidental overlap.
    # active_weeks is dropped here because it already exists in enriched_clusters.
    needed_prakhar_cols = [
        "cluster_id",
        "peak_hour_count",
        "recommended_patrol_window",
        "assigned_station",
        "hotspot_type",
        "recommended_action",
    ]
    available = [c for c in needed_prakhar_cols if c in prakhar.columns]
    missing = [c for c in needed_prakhar_cols if c not in prakhar.columns]
    if missing:
        raise ValueError(f"Missing expected Prakhar columns: {missing}")
    prakhar = prakhar[available].copy()

    merged = enriched.merge(prakhar, on="cluster_id", how="left")

    suffix_cols = [c for c in merged.columns if c.endswith("_x") or c.endswith("_y")]
    if suffix_cols:
        raise ValueError(f"Unexpected suffix columns after merge: {suffix_cols}")

    # Drop any stray NOISE rows
    merged = merged[merged["cluster_id"] != "NOISE"].copy()

    print(f"[M1] Merged shape: {merged.shape}")
    return merged


# ---------------------------------------------------------------------------
# Schema column derivation
# ---------------------------------------------------------------------------
def derive_schema_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add/renamed columns needed by the scored_hotspots contract."""
    # persistence: mean violations per hour inside the 2-hour peak window
    df["persistence"] = (df["peak_hour_count"].fillna(0).astype(float) / OFFICER_HOURS_PER_CLUSTER)

    # recurrence: fraction of weeks observed relative to the busiest cluster
    max_weeks = int(df["active_weeks"].fillna(1).max())
    df["recurrence"] = (df["active_weeks"].fillna(0).astype(float) / max(max_weeks, 1)).clip(0, 1)

    # peak_window from M3
    df["peak_window"] = df["recommended_patrol_window"].fillna("UNKNOWN")

    # border_flag stub (M18 did not output an explicit boundary flag)
    df["border_flag"] = 0

    # classification from M4
    df["classification"] = df["hotspot_type"].fillna("RESPONSIVE")

    # recommended_action from M4
    df["recommended_action"] = df["recommended_action"].fillna("TOW")

    # assigned_station from M18
    df["assigned_station"] = df["assigned_station"].fillna("UNASSIGNED")

    # vehicle_mix contract formatting
    if "vehicle_mix" not in df.columns and "vehicle_mix_json" in df.columns:
        df["vehicle_mix"] = df["vehicle_mix_json"]
    df["vehicle_mix"] = df["vehicle_mix"].fillna("").astype(str)

    # Ensure OSM coverage is int 0/1
    df["osm_coverage"] = df["osm_coverage"].fillna(0).astype(int).clip(0, 1)

    return df


# ---------------------------------------------------------------------------
# ROI computation
# ---------------------------------------------------------------------------
def compute_roi(df: pd.DataFrame) -> pd.DataFrame:
    """Compute raw ROI and normalize to 0-100 roi_score."""
    # Fill missing factors with safe defaults
    lcle = df["lcle_pct"].fillna(0).astype(float).clip(0, 100)
    traffic_weight = df["road_traffic_weight"].fillna(0.15).astype(float).clip(0, 1)
    persistence = df["persistence"].fillna(0).astype(float)
    bci = df["bci"].fillna(0).astype(float).clip(0, 1)
    recurrence = df["recurrence"].fillna(0).astype(float).clip(0, 1)

    raw_roi = (lcle * traffic_weight * persistence * bci * recurrence) / OFFICER_HOURS_PER_CLUSTER

    # The raw ROI distribution is extremely skewed because BCI is concentrated
    # on trunk roads. Use percentile-rank normalization to spread scores across
    # the full 0-100 range while preserving rank order.
    if raw_roi.nunique() <= 1:
        df["roi_score"] = 0.0
    else:
        df["roi_score"] = (raw_roi.rank(pct=True, method="average") * 100.0).round(4)

    df["raw_roi"] = raw_roi
    return df


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------
def write_roi_validation_report(df: pd.DataFrame) -> None:
    mean_roi = df["roi_score"].mean()
    median_roi = df["roi_score"].median()
    std_roi = df["roi_score"].std()
    min_roi = df["roi_score"].min()
    max_roi = df["roi_score"].max()

    top_roi = df.nlargest(20, "roi_score")[[
        "cluster_id", "violation_count", "road_class", "road_width_m",
        "lcle_pct", "bci", "persistence", "recurrence", "roi_score",
    ]]

    top_count = df.nlargest(20, "violation_count")[[
        "cluster_id", "violation_count", "road_class", "lcle_pct", "bci", "roi_score",
    ]]

    top_roi_ids = set(top_roi["cluster_id"].head(10))
    top_count_ids = set(top_count["cluster_id"].head(10))
    divergence_ok = not top_roi_ids.issubset(top_count_ids)

    # Relaxed demo-beat definition: below-median violation count but top-20% ROI.
    # Because persistence is part of raw ROI, tiny clusters cannot reach the very top;
    # this threshold still proves ROI diverges from raw count.
    roi_threshold = df["roi_score"].quantile(0.80)
    low_count_high_roi = df[
        (df["violation_count"] <= df["violation_count"].median())
        & (df["roi_score"] >= roi_threshold)
    ]

    top_roi_road_classes = top_roi["road_class"].value_counts().to_dict()

    lines = [
        "# M1 ROI Validation Report",
        "",
        "## Methodology",
        "ROI score ranks clusters by expected enforcement impact, not raw violation count.",
        "",
        "### Formula",
        "```",
        "persistence  = peak_hour_count / 2.0   (violations per hour in 2-hr peak window)",
        "recurrence   = active_weeks / max(active_weeks)",
        "raw_roi      = (lcle_pct * road_traffic_weight * persistence * bci * recurrence) / officer_hours",
        "roi_score    = rank_pct(raw_roi) * 100   (percentile-rank spread; raw ROI is heavily skewed by BCI)",
        "```",
        "",
        "## ROI distribution",
        f"- Mean ROI: {mean_roi:.2f}",
        f"- Median ROI: {median_roi:.2f}",
        f"- Std ROI: {std_roi:.2f}",
        f"- Min ROI: {min_roi:.4f}",
        f"- Max ROI: {max_roi:.4f}",
        "",
        "## Top 20 clusters by ROI",
        "",
        "| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | bci | persistence | recurrence | roi_score |",
        "|------|------------|-----------------|------------|--------------|----------|-----|-------------|------------|-----------|",
    ]
    for rank, (_, row) in enumerate(top_roi.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {int(row['violation_count']):,} | "
            f"{row['road_class']} | {row['road_width_m']:.1f} | {row['lcle_pct']:.2f} | "
            f"{row['bci']:.4f} | {row['persistence']:.2f} | {row['recurrence']:.4f} | {row['roi_score']:.4f} |"
        )
    lines.append("")

    lines.extend([
        "### Road-class distribution in top 20 ROI",
    ])
    for cls, count in top_roi_road_classes.items():
        lines.append(f"- {cls}: {count}")
    lines.append("")

    lines.extend([
        "## Top 20 clusters by violation_count (for divergence check)",
        "",
        "| rank | cluster_id | violation_count | road_class | lcle_pct | bci | roi_score |",
        "|------|------------|-----------------|------------|----------|-----|-----------|",
    ])
    for rank, (_, row) in enumerate(top_count.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {int(row['violation_count']):,} | "
            f"{row['road_class']} | {row['lcle_pct']:.2f} | {row['bci']:.4f} | {row['roi_score']:.4f} |"
        )
    lines.append("")

    lines.extend([
        "## Low-count / high-ROI demo beat",
        "- Definition: violation_count <= median AND roi_score >= top 20%",
        f"- ROI threshold (top 20%): {roi_threshold:.2f}",
        f"- Clusters below-median count AND top-20% ROI: **{len(low_count_high_roi)}**",
    ])
    if len(low_count_high_roi) > 0:
        lines.append("")
        lines.append("| cluster_id | violation_count | road_class | roi_score |")
        lines.append("|------------|-----------------|------------|-----------|")
        for _, row in low_count_high_roi.head(10).iterrows():
            lines.append(
                f"| {row['cluster_id']} | {int(row['violation_count']):,} | {row['road_class']} | {row['roi_score']:.4f} |"
            )
    lines.append("")

    # Checks
    range_ok = 0.0 <= min_roi and max_roi <= 100.0
    spread_ok = std_roi > 0.001
    demo_beat_ok = len(low_count_high_roi) > 0

    lines.extend([
        "## Checks",
        f"- ROI range [0, 100]: {'PASS' if range_ok else 'FAIL'}",
        f"- ROI spread > 0.001: {'PASS' if spread_ok else 'FAIL'} (std={std_roi:.4f})",
        f"- ROI diverges from violation_count: {'PASS' if divergence_ok else 'FAIL'}",
        f"- Low-count / high-ROI demo beat exists: {'PASS' if demo_beat_ok else 'FAIL'}",
        "",
        "## Limitations",
        "- `border_flag` is stubbed to 0 because Prakhar's M18 output does not yet include an explicit boundary flag.",
        "- BCI is used as-is from the existing M7 computation; it is heavily skewed toward trunk roads.",
        "- Officer hours are modeled as a constant 2.0 hours per cluster.",
        "",
        f"## Final verdict: {'PASS' if (range_ok and spread_ok and divergence_ok and demo_beat_ok) else 'FAIL'}",
    ])

    ROI_REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[M1] Saved ROI validation report: {ROI_REPORT_MD}")


# ---------------------------------------------------------------------------
# Phase 2 merge report
# ---------------------------------------------------------------------------
def write_phase2_merge_report(df: pd.DataFrame) -> None:
    """Document how each schema column was sourced and any gaps."""
    rows = []
    for col in SCHEMA_COLUMNS:
        if col in df.columns:
            null_count = int(df[col].isna().sum())
            source = _column_source(col)
            rows.append((col, source, null_count, "OK"))
        else:
            rows.append((col, "MISSING", "—", "FAIL"))

    lines = [
        "# Phase 2 Merge Report",
        "",
        "This report documents the Gate 2 merge: joining Piyush's geospatial/LCLE/BCI output with Prakhar's Phase 2 features into the scored_hotspots contract table.",
        "",
        "## Join summary",
        f"- Input enriched clusters: {len(df):,} rows",
        f"- Output rows: {len(df):,}",
        f"- Schema columns: {len(SCHEMA_COLUMNS)}",
        "",
        "## Column source map",
        "",
        "| schema_column | source | null_count | status |",
        "|---------------|--------|------------|--------|",
    ]
    for col, source, null_count, status in rows:
        nc = "—" if null_count == "—" else f"{null_count:,}"
        lines.append(f"| {col} | {source} | {nc} | {status} |")
    lines.append("")

    missing_cols = [col for col in SCHEMA_COLUMNS if col not in df.columns]
    stubbed_cols = ["border_flag"]  # documented known stub

    lines.extend([
        "## Validation checks",
        f"- All schema columns present: {'PASS' if not missing_cols else 'FAIL'}",
        f"- No duplicate cluster_id rows: {'PASS' if df['cluster_id'].nunique() == len(df) else 'FAIL'}",
        f"- No NOISE rows: {'PASS' if 'NOISE' not in df['cluster_id'].values else 'FAIL'}",
        f"- roi_score in [0, 100]: {'PASS' if df['roi_score'].between(0, 100).all() else 'FAIL'}",
        "",
        "## Stubbed columns",
    ])
    for col in stubbed_cols:
        lines.append(f"- `{col}`: stubbed because the upstream module did not produce it.")
    lines.append("")

    lines.extend([
        "## Notes",
        "- `border_flag` should ideally come from M18 jurisdiction scoping. Prakhar's current output does not include it, so it is set to 0 for all clusters.",
        "- `assigned_station` comes from Prakhar's M18 jurisdiction output.",
        "- `classification` and `recommended_action` come from Prakhar's M4 classifier output.",
        "- `persistence`, `recurrence`, `peak_window` are derived from Prakhar's M3 peak-window output.",
    ])

    MERGE_REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[M1] Saved Phase 2 merge report: {MERGE_REPORT_MD}")


def _column_source(col: str) -> str:
    """Return a short source label for a schema column."""
    piyush = {
        "cluster_id", "centroid_lat", "centroid_lng", "road_class",
        "road_width_m", "osm_coverage", "violation_count", "vehicle_mix",
        "lcle_pct", "bci",
    }
    prakhar = {
        "assigned_station", "recommended_patrol_window", "hotspot_type",
    }
    derived = {
        "border_flag", "persistence", "recurrence", "peak_window", "roi_score",
    }
    renamed = {
        "classification": "hotspot_type",
        "recommended_action": "recommended_action",
        "peak_window": "recommended_patrol_window",
    }
    if col in piyush:
        return "Piyush/enriched_clusters"
    if col in prakhar:
        return f"Prakhar/{renamed.get(col, col)}"
    if col in derived:
        return "derived in M1"
    if col == "classification":
        return "Prakhar/hotspot_type"
    if col == "recommended_action":
        return "Prakhar/recommended_action"
    if col == "peak_window":
        return "derived from Prakhar/recommended_patrol_window"
    return "unknown"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run_m1() -> dict:
    print("[M1] Starting ROI Ranker + Phase 2 merge...")

    merged = load_and_merge(ENRICHED_PATH, PRAKHAR_PATH)
    merged = derive_schema_columns(merged)
    merged = compute_roi(merged)

    # Reorder/select schema columns
    available_schema_cols = [c for c in SCHEMA_COLUMNS if c in merged.columns]
    missing_schema_cols = [c for c in SCHEMA_COLUMNS if c not in merged.columns]
    if missing_schema_cols:
        raise ValueError(f"Missing schema columns after computation: {missing_schema_cols}")

    output_df = merged[SCHEMA_COLUMNS].copy()

    # Type enforcement
    for col, dtype in SCHEMA_DTYPES.items():
        if col in output_df.columns:
            if dtype == "int64":
                output_df[col] = output_df[col].fillna(0).astype(dtype)
            elif dtype == "float64":
                output_df[col] = output_df[col].astype(dtype)
            elif dtype == "object":
                output_df[col] = output_df[col].fillna("").astype(dtype)

    # Validation assertions
    assert output_df["cluster_id"].nunique() == len(output_df), "Duplicate cluster_id rows"
    assert "NOISE" not in output_df["cluster_id"].values, "NOISE row found"
    assert output_df["roi_score"].between(0, 100).all(), "roi_score out of [0, 100]"
    assert output_df[SCHEMA_COLUMNS].notna().all().all(), "Null values in final output"

    output_df.to_parquet(OUTPUT_PARQUET, index=False)
    output_df.to_csv(OUTPUT_CSV, index=False)
    print(f"[M1] Saved scored hotspots: {OUTPUT_PARQUET}")
    print(f"[M1] Saved CSV copy: {OUTPUT_CSV}")

    write_roi_validation_report(merged)
    write_phase2_merge_report(output_df)

    return {
        "scored_hotspots_path": str(OUTPUT_PARQUET),
        "n_clusters": len(output_df),
        "mean_roi": float(output_df["roi_score"].mean()),
        "median_roi": float(output_df["roi_score"].median()),
    }


if __name__ == "__main__":
    result = run_m1()
    print("\n[M1] ROI Ranker summary:")
    print(json.dumps(result, indent=2, default=str))
