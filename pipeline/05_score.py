"""
Stage M2 — LCLE (Lane Clearance Loss Estimate)

Purpose:
    Compute the estimated lane-capacity loss caused by illegal parking for each
    enriched cluster. LCLE is a 0–100% score that reflects how much of the road
    width is likely blocked by illegally parked vehicles, independent of raw
    violation count.

Inputs:
    data/processed/enriched_clusters.parquet

Outputs:
    data/processed/enriched_clusters.parquet (updated in place)

Key transformations:
    - Parse vehicle_mix_json safely.
    - daily_violation_rate = violation_count / max(active_days, 1)
    - occupancy_proxy = log1p(daily_violation_rate)
    - weighted_avg_vehicle_width = weighted mean of vehicle footprints
    - raw_block = occupancy_proxy * weighted_avg_vehicle_width
    - lcle_pct = min(100, (raw_block / max(road_width_m, 1)) * obstruction * 100)
    - lcle_confidence based on osm_coverage and cluster_quality
    - road_width_source based on osm_coverage

Owner:
    Piyush — Core ROI Pipeline spine (M2).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.officer.feedback_backend import get_feedback_summary_for_scoring

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORTS_DIR = PROJECT_ROOT / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

INPUT_ENRICHED_PARQUET = PROCESSED_DIR / "enriched_clusters.parquet"
OUTPUT_ENRICHED_PARQUET = PROCESSED_DIR / "enriched_clusters.parquet"
VALIDATION_REPORT_MD = REPORTS_DIR / "LCLE_VALIDATION_REPORT.md"

DEFAULT_FOOTPRINT = 1.5

VEHICLE_FOOTPRINT = {
    "TANKER": 2.6,
    "BUS": 2.5,
    "MAXI-CAB": 2.1,
    "CAR": 1.8,
    "PASSENGER AUTO": 1.5,
    "AUTO": 1.5,
    "MOTOR CYCLE": 0.7,
    "SCOOTER": 0.7,
    "MOPED": 0.7,
    "BIKE": 0.7,
    "LGV": 2.4,
    "HGV": 2.5,
    "VAN": 2.0,
    "JEEP": 1.8,
    "TEMPO": 2.0,
    "GOODS AUTO": 1.8,
    "LORRY/GOODS VEHICLE": 2.5,
    "MINI LORRY": 2.2,
    "PRIVATE BUS": 2.5,
    "BUS (BMTC/KSRTC)": 2.5,
    "TOURIST BUS": 2.5,
    "SCHOOL VEHICLE": 2.2,
    "TRACTOR": 2.0,
    "OTHERS": 1.5,
}


# ---------------------------------------------------------------------------
# LCLE helpers
# ---------------------------------------------------------------------------
def parse_vehicle_mix(mix_json: str | None) -> dict[str, int]:
    """Safely parse vehicle_mix_json into a vehicle -> count dict."""
    if mix_json is None or (isinstance(mix_json, float) and math.isnan(mix_json)):
        return {}
    try:
        parsed = json.loads(mix_json)
        if isinstance(parsed, dict):
            return {str(k): int(v) for k, v in parsed.items()}
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return {}


def weighted_avg_vehicle_width(mix: dict[str, int]) -> float:
    """Return weighted-average vehicle footprint width for the mix."""
    total_count = sum(mix.values())
    if total_count == 0:
        return DEFAULT_FOOTPRINT

    weighted_sum = sum(
        count * VEHICLE_FOOTPRINT.get(str(vehicle).strip().upper(), DEFAULT_FOOTPRINT)
        for vehicle, count in mix.items()
    )
    return weighted_sum / total_count


def compute_lcle(row: pd.Series) -> dict:
    """Compute LCLE and related columns for a single cluster row."""
    mix = parse_vehicle_mix(row.get("vehicle_mix_json"))
    weighted_avg_width = weighted_avg_vehicle_width(mix)

    violation_count = float(row.get("violation_count", 0))
    active_days = int(row.get("active_days", 1))
    daily_violation_rate = violation_count / max(active_days, 1)
    occupancy_proxy = math.log1p(daily_violation_rate)

    raw_block = occupancy_proxy * weighted_avg_width

    junction_flag_rate = float(row.get("junction_flag_rate", 0.0))
    obstruction = 1.5 if junction_flag_rate > 0.5 else 1.0

    road_width_m = float(row.get("road_width_m", DEFAULT_FOOTPRINT))
    road_width_m = max(road_width_m, 1.0)

    lcle_pct = min(100.0, (raw_block / road_width_m) * obstruction * 100.0)

    osm_coverage = int(row.get("osm_coverage", 0))
    cluster_quality = str(row.get("cluster_quality", "needs_review"))

    if cluster_quality == "needs_review":
        lcle_confidence = "LOW"
    elif osm_coverage == 1:
        lcle_confidence = "HIGH"
    else:
        lcle_confidence = "MEDIUM"

    road_width_source = "osm_width" if osm_coverage == 1 else "irc_default"

    return {
        "weighted_avg_vehicle_width": weighted_avg_width,
        "occupancy_proxy": occupancy_proxy,
        "raw_block": raw_block,
        "lcle_pct": lcle_pct,
        "lcle_confidence": lcle_confidence,
        "road_width_source": road_width_source,
    }


def add_lcle_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Apply LCLE computation to every row and attach new columns."""
    # Drop any stale LCLE result columns so re-runs are idempotent
    stale_cols = [
        "weighted_avg_vehicle_width", "occupancy_proxy", "raw_block",
        "lcle_pct", "lcle_confidence", "road_width_source",
    ]
    df = df.drop(columns=[c for c in stale_cols if c in df.columns])

    results = []
    for _, row in df.iterrows():
        results.append(compute_lcle(row))

    results_df = pd.DataFrame(results)
    return pd.concat([df.reset_index(drop=True), results_df], axis=1)


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------
def write_validation_report(df: pd.DataFrame) -> None:
    mean_lcle = df["lcle_pct"].mean()
    median_lcle = df["lcle_pct"].median()
    min_lcle = df["lcle_pct"].min()
    max_lcle = df["lcle_pct"].max()

    confidence_counts = df["lcle_confidence"].value_counts().to_dict()
    width_source_counts = df["road_width_source"].value_counts().to_dict()

    # Distribution buckets
    bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    df["lcle_bucket"] = pd.cut(df["lcle_pct"], bins=bins, include_lowest=True, right=False)
    bucket_counts = df["lcle_bucket"].value_counts().sort_index().to_dict()

    # Top 20 by LCLE
    top_lcle = df.nlargest(20, "lcle_pct")[[
        "cluster_id", "violation_count", "road_class", "road_width_m",
        "road_width_source", "weighted_avg_vehicle_width", "occupancy_proxy",
        "raw_block", "junction_flag_rate", "lcle_pct", "lcle_confidence",
    ]]

    # Top 20 by violation_count for comparison
    top_count = df.nlargest(20, "violation_count")[[
        "cluster_id", "violation_count", "road_class", "road_width_m", "lcle_pct",
    ]]

    # Verdict
    range_ok = 0.0 <= min_lcle and max_lcle <= 100.0
    divergence_ok = not set(top_lcle["cluster_id"].head(10)).issubset(set(top_count["cluster_id"].head(10)))
    verdict = "PASS" if (range_ok and divergence_ok) else "FAIL"

    lines = [
        "# LCLE Validation Report",
        "",
        "## Methodology",
        "LCLE estimates lane-capacity loss caused by illegal parking, not raw violation count.",
        "",
        "### Formula",
        "```",
        "daily_violation_rate = violation_count / max(active_days, 1)",
        "occupancy_proxy      = log1p(daily_violation_rate)",
        "weighted_avg_vehicle_width = Σ(count × footprint) / Σ(count)",
        "raw_block            = occupancy_proxy × weighted_avg_vehicle_width",
        "obstruction          = 1.5 if junction_flag_rate > 0.5 else 1.0",
        "lcle_pct             = min(100, (raw_block / max(road_width_m, 1)) × obstruction × 100)",
        "```",
        "",
        "### Confidence rules",
        "- HIGH: real OSM width/lanes and cluster_quality != needs_review",
        "- MEDIUM: IRC default width and cluster_quality != needs_review",
        "- LOW: cluster_quality == needs_review",
        "",
        "## LCLE distribution",
        f"- Mean LCLE: {mean_lcle:.2f}%",
        f"- Median LCLE: {median_lcle:.2f}%",
        f"- Min LCLE: {min_lcle:.2f}%",
        f"- Max LCLE: {max_lcle:.2f}%",
        "",
        "### Bucketed distribution",
        "| LCLE range | count | % |",
        "|------------|-------|---|",
    ]
    for bucket, count in bucket_counts.items():
        pct = count / len(df) * 100
        lines.append(f"| {bucket} | {count:,} | {pct:.1f}% |")
    lines.append("")

    lines.extend([
        "## Confidence distribution",
        "| confidence | count | % |",
        "|------------|-------|---|",
    ])
    for conf, count in confidence_counts.items():
        pct = count / len(df) * 100
        lines.append(f"| {conf} | {count:,} | {pct:.1f}% |")
    lines.append("")

    lines.extend([
        "## Road width source distribution",
        "| source | count | % |",
        "|--------|-------|---|",
    ])
    for source, count in width_source_counts.items():
        pct = count / len(df) * 100
        lines.append(f"| {source} | {count:,} | {pct:.1f}% |")
    lines.append("")

    lines.extend([
        "## Top 20 clusters by LCLE",
        "",
        "| rank | cluster_id | violation_count | road_class | road_width_m | source | avg_width | occupancy | raw_block | junction_rate | lcle_pct | confidence |",
        "|------|------------|-----------------|------------|--------------|--------|-----------|-----------|-----------|---------------|----------|------------|",
    ])
    for rank, (_, row) in enumerate(top_lcle.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {row['violation_count']:,} | "
            f"{row['road_class']} | {row['road_width_m']:.1f} | {row['road_width_source']} | "
            f"{row['weighted_avg_vehicle_width']:.2f} | {row['occupancy_proxy']:.2f} | "
            f"{row['raw_block']:.2f} | {row['junction_flag_rate']:.2f} | "
            f"{row['lcle_pct']:.2f} | {row['lcle_confidence']} |"
        )
    lines.append("")

    lines.extend([
        "## Top 20 clusters by violation_count (for divergence check)",
        "",
        "| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct |",
        "|------|------------|-----------------|------------|--------------|----------|",
    ])
    for rank, (_, row) in enumerate(top_count.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {row['violation_count']:,} | "
            f"{row['road_class']} | {row['road_width_m']:.1f} | {row['lcle_pct']:.2f} |"
        )
    lines.append("")

    lines.extend([
        "## Checks",
        f"- LCLE range 0–100: {'PASS' if range_ok else 'FAIL'} (min={min_lcle:.2f}, max={max_lcle:.2f})",
        f"- Top-LCLE diverges from top-count: {'PASS' if divergence_ok else 'FAIL'}",
        "",
        "## Limitations",
        "- LCLE uses an occupancy proxy (log1p of daily violation rate) because true dwell time of each illegally parked vehicle is unknown.",
        "- Vehicle footprint is a fixed average width per vehicle class; actual parked positioning (parallel, angled, double-parked) is not modeled.",
        "- Road width confidence is lower when IRC defaults are used (53.8% of clusters in this run).",
        "- Junction obstruction is a binary 1.5× multiplier based on junction_flag_rate > 0.5.",
        "",
        f"## Final verdict: {verdict}",
    ])

    VALIDATION_REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[M2] Saved validation report: {VALIDATION_REPORT_MD}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def score_lcle() -> dict:
    print(f"[M2] Loading enriched clusters: {INPUT_ENRICHED_PARQUET}")
    df = pd.read_parquet(INPUT_ENRICHED_PARQUET)
    print(f"[M2] Clusters loaded: {len(df):,}")

    required_cols = [
        "cluster_id", "violation_count", "active_days", "vehicle_mix_json",
        "road_width_m", "osm_coverage", "junction_flag_rate", "cluster_quality",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    print("[M2] Computing LCLE...")
    df = add_lcle_columns(df)

    # ------------------------------------------------------------------
    # M12 Feedback Loop integration
    # ------------------------------------------------------------------
    print("[M2] Loading feedback summary...")
    _FEEDBACK_COLS = [
        "feedback_event_count",
        "enforcement_done_count",
        "recurred_after_enforcement_count",
        "last_feedback_date",
        "last_outcome",
        "feedback_structural_boost",
    ]
    _NUMERIC_FEEDBACK_COLS = [
        "feedback_event_count",
        "enforcement_done_count",
        "recurred_after_enforcement_count",
        "feedback_structural_boost",
    ]
    _TEXT_FEEDBACK_COLS = ["last_feedback_date", "last_outcome"]

    def _fill_feedback_defaults(df):
        for col in _NUMERIC_FEEDBACK_COLS:
            if col in df.columns:
                df[col] = df[col].fillna(0).astype(int)
        for col in _TEXT_FEEDBACK_COLS:
            if col in df.columns:
                df[col] = df[col].fillna("").astype(str)
        return df

    try:
        feedback = get_feedback_summary_for_scoring()
        # Drop stale feedback columns from df before merging to prevent _x/_y suffix collisions
        df = df.drop(columns=[c for c in _FEEDBACK_COLS if c in df.columns], errors="ignore")
        if not feedback.empty:
            keep = ["cluster_id"] + [c for c in _FEEDBACK_COLS if c in feedback.columns]
            df = df.merge(feedback[keep], on="cluster_id", how="left")
            df = _fill_feedback_defaults(df)
            boost_count = int(df["feedback_structural_boost"].sum())
            print(f"[M2] Feedback events merged. Clusters with structural boost: {boost_count}")
        else:
            for col in _NUMERIC_FEEDBACK_COLS:
                df[col] = 0
            for col in _TEXT_FEEDBACK_COLS:
                df[col] = ""
            print("[M2] No feedback events found; structural boost column set to 0 for all clusters.")
    except Exception as exc:
        import traceback
        print(f"[M2] Warning: could not load feedback summary ({type(exc).__name__}: {exc}).")
        print(traceback.format_exc())
        df = df.drop(columns=[c for c in _FEEDBACK_COLS if c in df.columns], errors="ignore")
        for col in _NUMERIC_FEEDBACK_COLS:
            df[col] = 0
        for col in _TEXT_FEEDBACK_COLS:
            df[col] = ""

    # Sort by lcle_pct descending for convenience
    df = df.sort_values("lcle_pct", ascending=False).reset_index(drop=True)

    df.to_parquet(OUTPUT_ENRICHED_PARQUET, index=False)
    print(f"[M2] Saved updated enriched clusters: {OUTPUT_ENRICHED_PARQUET}")

    mean_lcle = df["lcle_pct"].mean()
    median_lcle = df["lcle_pct"].median()
    print(f"[M2] LCLE mean: {mean_lcle:.2f}%, median: {median_lcle:.2f}%")

    write_validation_report(df)

    return {
        "enriched_clusters_path": str(OUTPUT_ENRICHED_PARQUET),
        "n_clusters": len(df),
        "mean_lcle": float(mean_lcle),
        "median_lcle": float(median_lcle),
    }


if __name__ == "__main__":
    result = score_lcle()
    print("\n[M2] LCLE scoring summary:")
    print(json.dumps(result, indent=2, default=str))
