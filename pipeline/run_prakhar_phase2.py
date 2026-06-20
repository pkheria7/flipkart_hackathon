"""
Prakhar Phase 2 runner.

Usage:
    python pipeline/run_prakhar_phase2.py --m3
    python pipeline/run_prakhar_phase2.py --m18
    python pipeline/run_prakhar_phase2.py --m4
    python pipeline/run_prakhar_phase2.py --merge
    python pipeline/run_prakhar_phase2.py --all-current   (M3 → M18 → M4 → merge)

Flags:
    --m3           Run M3 Peak Window Predictor only.
    --m18          Run M18 Jurisdiction Scoping only.
    --m4           Run M4 Structural vs Responsive Classifier only.
    --merge        Run Merge Handoff (03c) — joins M3/M18/M4 into prakhar_cluster_features.
    --all-current  Run M3, M18, M4, merge in sequence.
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------------------
# Dynamic module loaders (filenames start with digits — not importable directly)
# ---------------------------------------------------------------------------

def _load_module(name: str, rel_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _get_m3_run():
    return _load_module("pipeline_03a_peak_windows",
                        "pipeline/03a_peak_windows.py").run


def _get_m18_run():
    return _load_module("pipeline_03_jurisdiction",
                        "pipeline/03_jurisdiction.py").run


def _get_m4_run():
    return _load_module("pipeline_03b_classify_hotspots",
                        "pipeline/03b_classify_hotspots.py").run


def _get_merge_module():
    return _load_module("pipeline_03c_merge_prakhar_features",
                        "pipeline/03c_merge_prakhar_features.py")


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HANDOFF_PATH   = ROOT / "data" / "processed" / "cluster_handoff_for_prakhar.parquet"
SUMMARY_PATH   = ROOT / "data" / "processed" / "cluster_summary.parquet"

M3_PARQUET     = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
M3_CSV         = ROOT / "data" / "processed" / "cluster_peak_windows.csv"
M3_REPORT      = ROOT / "reports" / "PRAKHAR_PHASE2_M3_REPORT.md"

M18_JC_PARQUET = ROOT / "data" / "processed" / "jurisdiction_clusters.parquet"
M18_JC_CSV     = ROOT / "data" / "processed" / "jurisdiction_clusters.csv"
M18_SW_PARQUET = ROOT / "data" / "processed" / "station_workload_summary.parquet"
M18_SW_CSV     = ROOT / "data" / "processed" / "station_workload_summary.csv"
M18_REPORT     = ROOT / "reports" / "PRAKHAR_PHASE2_M18_REPORT.md"

M4_CL_PARQUET  = ROOT / "data" / "processed" / "cluster_classification.parquet"
M4_CL_CSV      = ROOT / "data" / "processed" / "cluster_classification.csv"
M4_REPORT      = ROOT / "reports" / "PRAKHAR_PHASE2_M4_REPORT.md"

MERGE_PARQUET  = ROOT / "data" / "processed" / "prakhar_cluster_features.parquet"
MERGE_CSV      = ROOT / "data" / "processed" / "prakhar_cluster_features.csv"
MERGE_REPORT   = ROOT / "reports" / "PRAKHAR_PHASE2_MERGE_REPORT.md"

VALID_HTYPES   = {"STRUCTURAL", "RESPONSIVE", "SEASONAL"}


# ===========================================================================
# M3 section
# ===========================================================================

def verify_m3(result: pd.DataFrame, summary: pd.DataFrame) -> dict[str, bool]:
    expected_ids = set(summary["cluster_id"].tolist())
    actual_ids   = set(result["cluster_id"].tolist())
    return {
        "output_file_exists":          M3_PARQUET.exists() and M3_CSV.exists(),
        "one_row_per_cluster":         len(result) == result["cluster_id"].nunique(),
        "no_noise_rows":               "NOISE" not in actual_ids,
        "cluster_id_unique":           result["cluster_id"].nunique() == len(result),
        "no_missing_peak_hour":        result["peak_hour"].isna().sum() == 0,
        "hour_values_valid":           result["peak_hour"].between(0, 23).all(),
        "cluster_ids_match_summary":   expected_ids == actual_ids,
        "recommended_window_non_null": result["recommended_patrol_window"].isna().sum() == 0,
        "confidence_values_valid":     set(result["temporal_confidence"].unique()).issubset(
            {"HIGH", "MEDIUM", "LOW"}
        ),
    }


def write_m3_report(result: pd.DataFrame, summary: pd.DataFrame,
                    checks: dict[str, bool]) -> str:
    n_clusters    = len(result)
    handoff_rows  = int(pd.read_parquet(HANDOFF_PATH, columns=["is_clustered"])["is_clustered"].sum())
    confidence_dist = result["temporal_confidence"].value_counts().to_dict()
    peak_hour_dist  = result["peak_hour"].value_counts().sort_index().to_dict()
    day_type_dist   = result["peak_day_type"].value_counts().to_dict()

    top15 = (result.sort_values("total_violations", ascending=False)
             .head(15)[["cluster_id", "total_violations", "peak_hour",
                         "recommended_patrol_window", "peak_day_type",
                         "temporal_confidence"]])

    nr_ids = summary[summary["needs_manual_review"] == 1]["cluster_id"].tolist()
    nr_df  = (result[result["cluster_id"].isin(nr_ids)]
              .sort_values("total_violations", ascending=False)
              .head(10)[["cluster_id", "total_violations", "peak_hour",
                          "recommended_patrol_window", "temporal_confidence"]])

    all_pass = all(checks.values())
    verdict  = "PASS" if all_pass else (
        "CONDITIONAL PASS" if sum(checks.values()) >= len(checks) - 1 else "FAIL")

    lines = [
        "# Prakhar Phase 2 — M3 Peak Window Report", "",
        "## Verdict", "", f"**{verdict}**", "", "---", "",
        "## Inputs Used", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_handoff_for_prakhar.parquet` | {handoff_rows:,} (clustered, NOISE excluded) |",
        f"| `data/processed/cluster_summary.parquet` | {len(summary):,} clusters |",
        "", "---", "",
        "## Outputs Created", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_peak_windows.parquet` | {n_clusters} |",
        f"| `data/processed/cluster_peak_windows.csv` | {n_clusters} |",
        "", "---", "",
        "## Method", "",
        "**Noise filtering:**  Rows with `is_clustered != 1` or `cluster_id == 'NOISE'` are",
        "excluded before any computation.  The 39,139 noise rows from Phase 2 are never",
        "included in the peak window analysis.", "",
        "**Peak hour calculation:**  For each cluster, violations are counted per IST hour",
        "(0-23) using the pre-computed `hour` column in the handoff file.  The hour with the",
        "highest total count across all days becomes `peak_hour`.  No assumptions about",
        "morning/evening are baked in — the data decides.", "",
        "**Weekday / weekend handling:**  Separate peak hours are computed for weekday rows",
        "(`is_weekend == 0`) and weekend rows (`is_weekend == 1`).  `peak_day_type` is",
        "classified as WEEKDAY if >= 65% of violations occur on weekdays, WEEKEND if >= 65%",
        "occur on weekends, and MIXED otherwise.", "",
        "**Recommended patrol window:**  The window starts at `peak_hour` and runs for two",
        "hours.  Midnight wrap is handled safely (hour 23 -> 23:00-01:00).  The secondary",
        "window uses the second-highest violation hour.", "",
        "**Temporal concentration score:**  Share of total violations falling in the top-3",
        "hours.  A uniform distribution across 24 hours gives ~0.125; a tightly",
        "concentrated peak can reach > 0.6.", "",
        "**Temporal confidence rules (deterministic):**", "",
        "| Tier | Condition |", "|------|-----------|",
        "| HIGH | total_violations >= 100 AND active_days >= 14 AND concentration >= 0.25 |",
        "| MEDIUM | total_violations >= 30 OR active_days >= 7 (and not HIGH) |",
        "| LOW | all other cases (sparse data or flat distribution) |",
        "", "---", "",
        "## Summary Metrics", "",
        f"- **Clusters processed:** {n_clusters}",
        f"- **Clustered violation rows used:** {handoff_rows:,}", "",
        "**Peak hour distribution (hour -> cluster count):**", "",
        "| Hour | Clusters |", "|------|----------|",
    ]
    for h, cnt in sorted(peak_hour_dist.items()):
        lines.append(f"| {h:02d}:00 | {cnt} |")

    lines += ["", "**Temporal confidence distribution:**", "",
              "| Confidence | Clusters |", "|------------|----------|"]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {confidence_dist.get(tier, 0)} |")

    lines += ["", "**Weekday / Weekend / Mixed distribution:**", "",
              "| Day Type | Clusters |", "|----------|----------|"]
    for dt in ["WEEKDAY", "WEEKEND", "MIXED"]:
        lines.append(f"| {dt} | {day_type_dist.get(dt, 0)} |")

    lines += ["", "---", "", "## Top 15 Peak Window Recommendations", "",
              "| cluster_id | total_violations | peak_hour | recommended_patrol_window | peak_day_type | temporal_confidence |",
              "|------------|-----------------|-----------|--------------------------|---------------|---------------------|"]
    for _, row in top15.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.total_violations:,} | {row.peak_hour:02d}:00 | "
            f"{row.recommended_patrol_window} | {row.peak_day_type} | {row.temporal_confidence} |")

    lines += ["", "---", "", "## Needs-Review Clusters (Top 10 by violation count)", "",
              "These clusters were flagged `needs_manual_review = 1` in Phase 2.  Their peak",
              "windows are computed normally but should be interpreted with care.", "",
              "| cluster_id | total_violations | peak_hour | recommended_patrol_window | temporal_confidence |",
              "|------------|-----------------|-----------|--------------------------|---------------------|"]
    for _, row in nr_df.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.total_violations:,} | {row.peak_hour:02d}:00 | "
            f"{row.recommended_patrol_window} | {row.temporal_confidence} |")

    lines += ["", "---", "", "## Verification Checks", "",
              "| Check | Status |", "|-------|--------|"]
    for check, passed in checks.items():
        lines.append(f"| {check.replace('_', ' ')} | {'PASS' if passed else 'FAIL'} |")

    lines += ["", "---", "", "## Limitations", "",
              "- Peak windows are derived from **historical violation timestamps**, not live traffic speed.",
              "- The recommended patrol window is a data-driven suggestion, not a guaranteed congestion fix.",
              "- Large needs-review clusters aggregate diverse micro-locations into one peak hour.",
              "- `active_days` / `active_weeks` reflect the Nov 2023 - Apr 2024 observation window.",
              "", "---", "", "## Final Recommendation", "",
              f"M3 outputs are {'ready' if all_pass else 'not yet ready'} to merge into Prakhar Phase 2.",
              "The `cluster_peak_windows.parquet` file is safe to join onto `cluster_summary` by",
              "`cluster_id` and hand off to M18 and M4.",
              "The `recommended_patrol_window` and `temporal_confidence` columns feed directly",
              "into the final scored_hotspots schema."]

    content = "\n".join(lines) + "\n"
    M3_REPORT.parent.mkdir(parents=True, exist_ok=True)
    M3_REPORT.write_text(content, encoding="utf-8")
    return content


def main_m3(verbose: bool = True) -> None:
    print("=" * 64)
    print("Prakhar Phase 2 — M3 Peak-Time Patrol Window Predictor")
    print("=" * 64)
    print(f"\nInputs:\n  {HANDOFF_PATH}\n  {SUMMARY_PATH}")
    print("\nRunning M3 ...", flush=True)

    run_m3 = _get_m3_run()
    result  = run_m3(handoff_path=HANDOFF_PATH, summary_path=SUMMARY_PATH,
                     out_parquet=M3_PARQUET, out_csv=M3_CSV)
    summary = pd.read_parquet(SUMMARY_PATH)

    print(f"\nOutputs:\n  {M3_PARQUET}  [{M3_PARQUET.exists()}]")
    print(f"  {M3_CSV}  [{M3_CSV.exists()}]")
    print(f"\nClusters processed: {len(result)}")

    print("\n--- Top 10 Peak Window Rows ---")
    top10 = (result.sort_values("total_violations", ascending=False)
             .head(10)[["cluster_id", "total_violations", "peak_hour",
                         "recommended_patrol_window", "peak_day_type", "temporal_confidence"]])
    print(top10.to_string(index=False))

    print("\n--- Verification ---")
    checks   = verify_m3(result, summary)
    all_pass = True
    for check, passed in checks.items():
        if not passed:
            all_pass = False
        print(f"  [{'PASS' if passed else 'FAIL'}] {check}")
    print(f"\nOverall: {'ALL CHECKS PASS' if all_pass else 'SOME CHECKS FAILED'}")

    if verbose:
        print(f"\nGenerating report -> {M3_REPORT}")
        content = write_m3_report(result, summary, checks)
        print("\n" + "=" * 64 + "\nREPORT CONTENT:\n" + "=" * 64)
        print(content)


# ===========================================================================
# M18 section
# ===========================================================================

def verify_m18(jdf: pd.DataFrame, wdf: pd.DataFrame,
               summary: pd.DataFrame) -> dict[str, bool]:
    expected_ids    = set(summary["cluster_id"].tolist())
    actual_ids      = set(jdf["cluster_id"].tolist())
    sum_viol_jdf    = int(jdf["violation_count"].sum())
    sum_viol_wdf    = int(wdf["station_total_violations"].sum())
    station_count_jdf = jdf["assigned_station"].nunique()
    station_count_wdf = len(wdf)
    valid_bands     = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}

    pw_exists = M3_PARQUET.exists()
    pw_join_ok = True
    if pw_exists and "top_cluster_peak_window" in wdf.columns:
        # at least one critical/high station should have a peak window
        top_stations = wdf[wdf["station_priority_band"].isin({"CRITICAL", "HIGH"})]
        pw_join_ok = top_stations["top_cluster_peak_window"].notna().any()

    return {
        "jc_output_exists":               M18_JC_PARQUET.exists() and M18_JC_CSV.exists(),
        "sw_output_exists":               M18_SW_PARQUET.exists() and M18_SW_CSV.exists(),
        "one_row_per_cluster":            len(jdf) == jdf["cluster_id"].nunique(),
        "cluster_id_unique":              jdf["cluster_id"].nunique() == len(jdf),
        "cluster_ids_match_summary":      expected_ids == actual_ids,
        "assigned_station_non_null":      jdf["assigned_station"].isna().sum() == 0,
        "station_count_consistent":       station_count_jdf == station_count_wdf,
        "violation_totals_match":         sum_viol_jdf == sum_viol_wdf,
        "priority_bands_valid":           set(jdf["station_priority_band"].unique()).issubset(valid_bands),
        "m3_peak_window_joined_ok":       pw_join_ok,
    }


def write_m18_report(jdf: pd.DataFrame, wdf: pd.DataFrame,
                     summary: pd.DataFrame, checks: dict[str, bool]) -> str:
    n_clusters  = len(jdf)
    n_stations  = len(wdf)
    total_viol  = int(jdf["violation_count"].sum())
    all_pass    = all(checks.values())
    verdict     = "PASS" if all_pass else (
        "CONDITIONAL PASS" if sum(checks.values()) >= len(checks) - 1 else "FAIL")

    conf_dist   = jdf["station_assignment_confidence"].value_counts().to_dict()
    band_dist   = jdf["station_priority_band"].value_counts().to_dict()
    n_top_hot   = int(jdf["is_top_station_hotspot"].sum())

    top15_st = (wdf.sort_values("station_rank_by_violations")
                .head(15)[["assigned_station", "station_total_violations",
                            "station_total_clusters", "station_priority_band",
                            "top_cluster_id", "top_cluster_violations"]])

    top20_hot = (jdf.sort_values("violation_count", ascending=False)
                 .head(20)[["cluster_id", "assigned_station", "violation_count",
                             "station_cluster_rank", "is_top_station_hotspot",
                             "station_assignment_confidence", "station_priority_band"]])

    nr_df = (jdf[jdf["needs_manual_review"] == 1]
             .sort_values("violation_count", ascending=False)
             .head(10)[["cluster_id", "assigned_station", "violation_count",
                         "cluster_quality", "station_assignment_confidence",
                         "jurisdiction_notes"]])

    pw_note = ("M3 peak windows joined onto station workload summary."
               if M3_PARQUET.exists() else
               "M3 peak windows not available (run --m3 first).")

    lines = [
        "# Prakhar Phase 2 — M18 Jurisdiction Scoping Report", "",
        "## Verdict", "", f"**{verdict}**", "", "---", "",
        "## Inputs Used", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_summary.parquet` | {len(summary):,} clusters |",
        f"| `data/processed/cluster_peak_windows.parquet` | {n_clusters} clusters (M3, optional) |",
        "", "---", "",
        "## Outputs Created", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/jurisdiction_clusters.parquet` | {n_clusters} |",
        f"| `data/processed/jurisdiction_clusters.csv` | {n_clusters} |",
        f"| `data/processed/station_workload_summary.parquet` | {n_stations} |",
        f"| `data/processed/station_workload_summary.csv` | {n_stations} |",
        "", "---", "",
        "## Method", "",
        "**Station assignment:** Each cluster is assigned to a station using the",
        "`police_station_mode` column from `cluster_summary.parquet` — the most",
        "frequently observed police station tag on violations within that cluster.",
        "No GIS polygon boundaries or spatial joins are used in this module.",
        "This is *FTVR-observed jurisdiction*, not official legal boundary assignment.", "",
        "**Assignment confidence rules (deterministic):**", "",
        "| Tier | Condition |", "|------|-----------|",
        "| HIGH | police_station_mode non-null AND cluster_quality in {good, medium} AND needs_manual_review == 0 |",
        "| MEDIUM | police_station_mode non-null AND (cluster_quality == needs_review OR needs_manual_review == 1) |",
        "| LOW | police_station_mode null or empty |", "",
        "**Station workload:** Total violations, cluster count, good/medium/needs_review",
        "split, average and max cluster size are aggregated per assigned station.", "",
        "**Hotspot ranking within station:** Clusters are ranked by `violation_count`",
        "descending within each station.  The `is_top_station_hotspot` flag is set for",
        "the top N clusters where N = min(10, max(3, floor(station_total_clusters * 0.20))).",
        "This ensures at least 3 flagged hotspots per station and a maximum of 10,",
        "capturing the busiest 20% as a sensible middle ground.", "",
        "**Station priority bands** (based on station total violations, not per-cluster):", "",
        "| Band | Threshold |", "|------|-----------|",
        "| CRITICAL | >= 90th percentile of all station totals (approx >= 12,800 violations) |",
        "| HIGH | >= 75th percentile (approx >= 4,500 violations) |",
        "| MEDIUM | >= 50th percentile (approx >= 2,400 violations) |",
        "| LOW | below median |", "",
        "**Limitation:** Station assignment reflects where violations were recorded, not",
        "official police station operational boundaries.  Clusters near station borders",
        "may be logged under either neighbouring station depending on officer deployment.", "",
        pw_note,
        "", "---", "",
        "## Summary Metrics", "",
        f"- **Clusters processed:** {n_clusters}",
        f"- **Police stations:** {n_stations}",
        f"- **Total violations represented:** {total_viol:,}",
        f"- **Top-station hotspots flagged:** {n_top_hot}", "",
        "**Station assignment confidence distribution:**", "",
        "| Confidence | Clusters |", "|------------|----------|",
    ]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {conf_dist.get(tier, 0)} |")

    lines += ["", "**Station priority band distribution (cluster count):**", "",
              "| Band | Clusters |", "|------|----------|"]
    for band in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {band} | {band_dist.get(band, 0)} |")

    lines += ["", "---", "", "## Top 15 Stations by Violation Burden", "",
              "| assigned_station | station_total_violations | station_total_clusters | station_priority_band | top_cluster_id | top_cluster_violations |",
              "|-----------------|--------------------------|----------------------|----------------------|----------------|------------------------|"]
    for _, row in top15_st.iterrows():
        lines.append(
            f"| {row.assigned_station} | {row.station_total_violations:,} | "
            f"{row.station_total_clusters} | {row.station_priority_band} | "
            f"{row.top_cluster_id} | {row.top_cluster_violations:,} |")

    lines += ["", "---", "", "## Top 20 Station Hotspots", "",
              "| cluster_id | assigned_station | violation_count | station_cluster_rank | is_top_station_hotspot | station_assignment_confidence | station_priority_band |",
              "|------------|-----------------|----------------|---------------------|----------------------|------------------------------|----------------------|"]
    for _, row in top20_hot.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.violation_count:,} | "
            f"{row.station_cluster_rank} | {int(row.is_top_station_hotspot)} | "
            f"{row.station_assignment_confidence} | {row.station_priority_band} |")

    lines += ["", "---", "", "## Needs-Review Jurisdiction Cases", "",
              "Clusters with `needs_manual_review == 1` sorted by violation count.",
              "These may span station boundaries or represent unusually large geographic areas.", "",
              "| cluster_id | assigned_station | violation_count | cluster_quality | assignment_confidence | jurisdiction_notes |",
              "|------------|-----------------|----------------|----------------|----------------------|-------------------|"]
    for _, row in nr_df.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.violation_count:,} | "
            f"{row.cluster_quality} | {row.station_assignment_confidence} | {row.jurisdiction_notes} |")

    lines += ["", "---", "", "## Verification Checks", "",
              "| Check | Status |", "|-------|--------|"]
    for check, passed in checks.items():
        lines.append(f"| {check.replace('_', ' ')} | {'PASS' if passed else 'FAIL'} |")

    lines += ["", "---", "", "## Limitations", "",
              "- Station assignment uses `police_station_mode` (most common station tag on",
              "  violations in each cluster), **not** official polygon boundary mapping.",
              "  Clusters near station borders may be assigned to either neighbouring station.",
              "- Mixed-station edge cases: clusters with violations logged under two stations",
              "  nearly equally will be assigned to one by mode — the minority gets dropped.",
              "- Station burden reflects **recorded violations**, not the total population of",
              "  illegal parking events.  Under-enforced areas will appear lower-burden.",
              "- No officer availability, shift strength, or vehicle allocation data is",
              "  incorporated.  Workload numbers are violation counts, not officer-hours.",
              "", "---", "", "## Final Recommendation", "",
              f"M18 outputs are {'ready' if all_pass else 'not yet ready'} to merge into Prakhar Phase 2.",
              "The `jurisdiction_clusters.parquet` and `station_workload_summary.parquet` files",
              "are safe to join onto downstream modules (M4 Classifier, M10 VRP) by `cluster_id`",
              "and `assigned_station` respectively.",
              "The `station_priority_band`, `is_top_station_hotspot`, and `assigned_station`",
              "columns feed directly into the final scored_hotspots schema."]

    content = "\n".join(lines) + "\n"
    M18_REPORT.parent.mkdir(parents=True, exist_ok=True)
    M18_REPORT.write_text(content, encoding="utf-8")
    return content


def main_m18(verbose: bool = True) -> None:
    print("=" * 64)
    print("Prakhar Phase 2 — M18 Jurisdiction-Aware Allocation")
    print("=" * 64)
    print(f"\nInputs:\n  {SUMMARY_PATH}")
    if M3_PARQUET.exists():
        print(f"  {M3_PARQUET}  (M3 peak windows — present)")
    else:
        print(f"  {M3_PARQUET}  (M3 peak windows — NOT FOUND, will skip enrichment)")

    print("\nRunning M18 ...", flush=True)
    run_m18  = _get_m18_run()
    jdf, wdf = run_m18(
        summary_path=SUMMARY_PATH,
        peak_windows_path=M3_PARQUET,
        out_clusters_parquet=M18_JC_PARQUET,
        out_clusters_csv=M18_JC_CSV,
        out_station_parquet=M18_SW_PARQUET,
        out_station_csv=M18_SW_CSV,
    )
    summary  = pd.read_parquet(SUMMARY_PATH)

    print(f"\nOutputs:")
    print(f"  {M18_JC_PARQUET}  [{M18_JC_PARQUET.exists()}]")
    print(f"  {M18_JC_CSV}  [{M18_JC_CSV.exists()}]")
    print(f"  {M18_SW_PARQUET}  [{M18_SW_PARQUET.exists()}]")
    print(f"  {M18_SW_CSV}  [{M18_SW_CSV.exists()}]")
    print(f"\nClusters processed: {len(jdf)}")
    print(f"Police stations found: {len(wdf)}")

    print("\n--- Top 10 Stations by Violations ---")
    top10_st = (wdf.sort_values("station_rank_by_violations")
                .head(10)[["assigned_station", "station_total_violations",
                            "station_total_clusters", "station_priority_band"]])
    print(top10_st.to_string(index=False))

    print("\n--- Verification ---")
    checks   = verify_m18(jdf, wdf, summary)
    all_pass = True
    for check, passed in checks.items():
        if not passed:
            all_pass = False
        print(f"  [{'PASS' if passed else 'FAIL'}] {check}")
    print(f"\nOverall: {'ALL CHECKS PASS' if all_pass else 'SOME CHECKS FAILED'}")

    if verbose:
        print(f"\nGenerating report -> {M18_REPORT}")
        content = write_m18_report(jdf, wdf, summary, checks)
        print("\n" + "=" * 64 + "\nREPORT CONTENT:\n" + "=" * 64)
        print(content)


# ===========================================================================
# M4 section
# ===========================================================================

def verify_m4(result: pd.DataFrame, summary: pd.DataFrame) -> dict[str, bool]:
    expected_ids = set(summary["cluster_id"].tolist())
    actual_ids   = set(result["cluster_id"].tolist())

    m3_join_ok = True
    if M3_PARQUET.exists() and "peak_hour" in result.columns:
        m3_join_ok = result["peak_hour"].notna().mean() > 0.95

    m18_join_ok = True
    if M18_JC_PARQUET.exists() and "assigned_station" in result.columns:
        m18_join_ok = result["assigned_station"].notna().mean() > 0.95

    valid_behavior = {"STRUCTURAL", "RESPONSIVE", "SEASONAL"}

    return {
        "output_file_exists":               M4_CL_PARQUET.exists() and M4_CL_CSV.exists(),
        "one_row_per_cluster":              len(result) == result["cluster_id"].nunique(),
        "cluster_id_unique":                result["cluster_id"].nunique() == len(result),
        "no_noise_rows":                    "NOISE" not in actual_ids,
        "cluster_ids_match_summary":        expected_ids == actual_ids,
        "no_missing_hotspot_type":          result["hotspot_type"].isna().sum() == 0,
        "hotspot_type_only_behavioral":     set(result["hotspot_type"].unique()).issubset(valid_behavior),
        "needs_review_absent_from_htype":   "NEEDS_REVIEW" not in result["hotspot_type"].unique(),
        "needs_review_flag_valid":          set(result["needs_review_flag"].unique()).issubset({0, 1}),
        "deployment_readiness_valid":       set(result["deployment_readiness"].unique()).issubset(
            {"READY", "REVIEW_FIRST"}
        ),
        "review_reason_non_null":           result["review_reason"].isna().sum() == 0,
        "recommended_action_non_null":      result["recommended_action"].isna().sum() == 0,
        "confidence_values_valid":          set(result["classification_confidence"].unique()).issubset(
            {"HIGH", "MEDIUM", "LOW"}
        ),
        "m3_peak_fields_joined":            m3_join_ok,
        "m18_station_joined":               m18_join_ok,
    }


def write_m4_report(result: pd.DataFrame, summary: pd.DataFrame,
                    checks: dict[str, bool]) -> str:
    n_clusters   = len(result)
    total_viol   = int(result["total_violations"].sum())
    all_pass     = all(checks.values())
    verdict      = "PASS" if all_pass else (
        "CONDITIONAL PASS" if sum(checks.values()) >= len(checks) - 1 else "FAIL")

    htype_dist   = result["hotspot_type"].value_counts().to_dict()
    conf_dist    = result["classification_confidence"].value_counts().to_dict()
    sig_dist     = result["behavior_signal_strength"].value_counts().to_dict()
    ready_dist   = result["deployment_readiness"].value_counts().to_dict()
    nrf_dist     = result["needs_review_flag"].value_counts().to_dict()

    avg_days_by_type = result.groupby("hotspot_type")["active_days"].mean().round(1).to_dict()
    avg_rec_by_type  = result.groupby("hotspot_type")["recurrence_rate_days"].mean().round(3).to_dict()

    # Truncate recommended_action for display (full strings are very long)
    result = result.copy()
    result["action_display"] = result["recommended_action"].str[:70]

    top20 = (result.sort_values("total_violations", ascending=False)
             .head(20)[["cluster_id", "assigned_station", "total_violations",
                         "hotspot_type", "deployment_readiness",
                         "action_display", "classification_confidence", "review_reason"]])

    review_first15 = (result[result["deployment_readiness"] == "REVIEW_FIRST"]
                      .sort_values("total_violations", ascending=False).head(15)
                      [["cluster_id", "assigned_station", "total_violations",
                        "hotspot_type", "classification_confidence", "review_reason"]])

    ready15 = (result[result["deployment_readiness"] == "READY"]
               .sort_values("total_violations", ascending=False).head(15)
               [["cluster_id", "assigned_station", "total_violations",
                 "hotspot_type", "classification_confidence", "m4_reason"]])

    struct_top10  = (result[result["hotspot_type"] == "STRUCTURAL"]
                     .sort_values("total_violations", ascending=False).head(10)
                     [["cluster_id", "assigned_station", "total_violations",
                       "active_days", "recurrence_rate_days",
                       "deployment_readiness", "classification_confidence"]])

    resp_top10    = (result[result["hotspot_type"] == "RESPONSIVE"]
                     .sort_values("total_violations", ascending=False).head(10)
                     [["cluster_id", "assigned_station", "total_violations",
                       "top_day_share", "active_days",
                       "deployment_readiness", "classification_confidence"]])

    seas_top10    = (result[result["hotspot_type"] == "SEASONAL"]
                     .sort_values("total_violations", ascending=False).head(10)
                     [["cluster_id", "assigned_station", "total_violations",
                       "weekend_share", "active_days",
                       "deployment_readiness", "classification_confidence"]])

    m3_note  = ("M3 peak fields joined." if M3_PARQUET.exists()
                else "M3 not available — peak_hour fields absent.")
    m18_note = ("M18 station fields joined." if M18_JC_PARQUET.exists()
                else "M18 not available — assigned_station fields absent.")

    lines = [
        "# Prakhar Phase 2 — M4 Structural vs Responsive Classifier Report (v2)", "",
        "## Verdict", "", f"**{verdict}**", "", "---", "",
        "## Design Fix Summary", "",
        "**Old design (v1):** `hotspot_type` could be NEEDS_REVIEW, which overrode",
        "behavioral classification.  This mixed two unrelated concerns — *what behavior*",
        "does the cluster show vs *is it safe to deploy enforcement here*.", "",
        "**New design (v2):** These are now fully separate layers.", "",
        "| Layer | Column | Values |", "|-------|--------|--------|",
        "| Behavioral | `hotspot_type` | STRUCTURAL / RESPONSIVE / SEASONAL |",
        "| Deployment gate | `deployment_readiness` | READY / REVIEW_FIRST |",
        "| Review flag | `needs_review_flag` | 0 / 1 |",
        "| Review explanation | `review_reason` | human-readable string |", "",
        "Every cluster now gets a behavioral type regardless of review status.",
        "A REVIEW_FIRST cluster still shows its behavioral type (e.g. STRUCTURAL)",
        "so downstream modules can pre-rank and pre-plan enforcement, while the",
        "deployment gate prevents premature field deployment.", "",
        "The `recommended_action` now combines both layers:",
        '- READY: base action (e.g. "Recurring patrol + towing...")',
        '- REVIEW_FIRST: "Review geography first; if confirmed, apply: <base action>"',
        "", "---", "",
        "## Inputs Used", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_handoff_for_prakhar.parquet` | row-level (clustered rows only) |",
        f"| `data/processed/cluster_summary.parquet` | {len(summary):,} clusters |",
        f"| `data/processed/cluster_peak_windows.parquet` | {n_clusters} clusters (M3) |",
        f"| `data/processed/jurisdiction_clusters.parquet` | {n_clusters} clusters (M18) |",
        "", "---", "",
        "## Outputs Created", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_classification.parquet` | {n_clusters} |",
        f"| `data/processed/cluster_classification.csv` | {n_clusters} |",
        "", "---", "",
        "## Method", "",
        "**Layer 1 — Behavioral classification (pure, ignores review flags):**", "",
        "Applied in priority order:", "",
        "1. **STRUCTURAL** — `active_days >= 30 AND active_weeks >= 8` (rule A),",
        "   OR `recurrence_rate_days >= 0.25 AND active_weeks >= 6` (rule B).",
        "   Signal: `recurrent_across_weeks`", "",
        "2. **SEASONAL** — `weekend_share >= 0.45` OR `peak_day_type == WEEKEND` (M3).",
        "   Signal: `weekend_dominant`", "",
        "3. **RESPONSIVE** — default for all others, including bursty (`top_day_share >= 0.35`),",
        "   short-term (`active_days < 14 AND violations >= 50`), and sparse clusters.",
        "   Signal: `burst_or_short_term` | `sparse_low_signal`", "",
        "**Layer 2 — Deployment readiness (independent of behavioral type):**", "",
        "| Condition | needs_review_flag | deployment_readiness |",
        "|-----------|------------------|----------------------|",
        "| cluster_quality == needs_review | 1 | REVIEW_FIRST |",
        "| needs_manual_review == 1 AND violations >= 5000 | 1 | REVIEW_FIRST |",
        "| needs_manual_review == 1 | 1 | REVIEW_FIRST |",
        "| otherwise | 0 | READY |", "",
        "**Confidence rules:**", "",
        "| Tier | Condition |", "|------|-----------|",
        "| HIGH | violations >= 100 AND active_days >= 14 AND (recurrence >= 0.15 OR top_day_share >= 0.25) |",
        "| MEDIUM | violations >= 30 OR active_days >= 7 (and not HIGH) |",
        "| LOW | all other cases |",
        "", "---", "",
        "## Summary Metrics", "",
        f"- **Clusters processed:** {n_clusters}",
        f"- **Total violations represented:** {total_viol:,}", "",
        "**Hotspot type distribution (behavioral):**", "",
        "| Type | Clusters |", "|------|----------|",
    ]
    for ht in ["STRUCTURAL", "RESPONSIVE", "SEASONAL"]:
        lines.append(f"| {ht} | {htype_dist.get(ht, 0)} |")

    lines += ["", "**Deployment readiness distribution:**", "",
              "| Readiness | Clusters |", "|-----------|----------|"]
    for dr in ["READY", "REVIEW_FIRST"]:
        lines.append(f"| {dr} | {ready_dist.get(dr, 0)} |")

    lines += ["", "**needs_review_flag distribution:**", "",
              "| Flag | Clusters |", "|------|----------|"]
    for flag in [0, 1]:
        lines.append(f"| {flag} | {nrf_dist.get(flag, 0)} |")

    lines += ["", "**Classification confidence distribution:**", "",
              "| Confidence | Clusters |", "|------------|----------|"]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {conf_dist.get(tier, 0)} |")

    lines += ["", "**Behavior signal strength distribution:**", "",
              "| Strength | Clusters |", "|----------|----------|"]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {sig_dist.get(tier, 0)} |")

    lines += ["", "**Average active_days by hotspot type:**", "",
              "| Type | Avg active_days | Avg recurrence_rate |",
              "|------|----------------|---------------------|"]
    for ht in ["STRUCTURAL", "RESPONSIVE", "SEASONAL"]:
        lines.append(
            f"| {ht} | {avg_days_by_type.get(ht, 'n/a')} | "
            f"{avg_rec_by_type.get(ht, 'n/a')} |")

    lines += ["", "---", "", "## Top 20 Classified Hotspots", "",
              "| cluster_id | assigned_station | total_violations | hotspot_type | deployment_readiness | recommended_action | classification_confidence | review_reason |",
              "|------------|-----------------|----------------|-------------|---------------------|-------------------|--------------------------|---------------|"]
    for _, row in top20.iterrows():
        rev_short = str(row["review_reason"])[:45]
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{row.hotspot_type} | {row.deployment_readiness} | "
            f"{row.action_display} | {row.classification_confidence} | {rev_short} |")

    lines += ["", "---", "", "## Review-First Hotspots (Top 15)", "",
              "These clusters have `deployment_readiness = REVIEW_FIRST` but still",
              "carry a behavioral hotspot_type for pre-planning.", "",
              "| cluster_id | assigned_station | total_violations | hotspot_type | classification_confidence | review_reason |",
              "|------------|-----------------|----------------|-------------|--------------------------|---------------|"]
    for _, row in review_first15.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{row.hotspot_type} | {row.classification_confidence} | {row.review_reason} |")

    lines += ["", "---", "", "## Ready Hotspots (Top 15)", "",
              "These clusters have `deployment_readiness = READY` — cleared for direct enforcement.", "",
              "| cluster_id | assigned_station | total_violations | hotspot_type | classification_confidence | m4_reason |",
              "|------------|-----------------|----------------|-------------|--------------------------|-----------|"]
    for _, row in ready15.iterrows():
        reason_short = str(row["m4_reason"])[:70]
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{row.hotspot_type} | {row.classification_confidence} | {reason_short} |")

    lines += ["", "---", "", "## Structural Hotspots (Top 10)", "",
              "| cluster_id | assigned_station | total_violations | active_days | recurrence_rate | deployment_readiness | classification_confidence |",
              "|------------|-----------------|----------------|------------|-----------------|---------------------|--------------------------|"]
    for _, row in struct_top10.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{int(row.active_days)} | {row.recurrence_rate_days:.3f} | "
            f"{row.deployment_readiness} | {row.classification_confidence} |")

    lines += ["", "---", "", "## Responsive Hotspots (Top 10)", "",
              "| cluster_id | assigned_station | total_violations | top_day_share | active_days | deployment_readiness | classification_confidence |",
              "|------------|-----------------|----------------|--------------|------------|---------------------|--------------------------|"]
    for _, row in resp_top10.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{row.top_day_share:.3f} | {int(row.active_days)} | "
            f"{row.deployment_readiness} | {row.classification_confidence} |")

    lines += ["", "---", "", "## Seasonal Hotspots (Top 10)", "",
              "| cluster_id | assigned_station | total_violations | weekend_share | active_days | deployment_readiness | classification_confidence |",
              "|------------|-----------------|----------------|--------------|------------|---------------------|--------------------------|"]
    for _, row in seas_top10.iterrows():
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.total_violations:,} | "
            f"{row.weekend_share:.3f} | {int(row.active_days)} | "
            f"{row.deployment_readiness} | {row.classification_confidence} |")

    lines += ["", "---", "", "## Verification Checks", "",
              "| Check | Status |", "|-------|--------|"]
    for check, passed in checks.items():
        lines.append(f"| {check.replace('_', ' ')} | {'PASS' if passed else 'FAIL'} |")

    lines += ["", "---", "", "## Limitations", "",
              "- **Rule-based classifier, not trained supervised ML.**  No historical",
              "  enforcement outcome labels exist (`action_taken_timestamp` and",
              "  `closed_datetime` are fully NULL in the dataset).  Rules are calibrated",
              "  on violation recurrence patterns only.",
              "- **Review flag means geographic/operator inspection is required, not bad data.**",
              "  The `needs_manual_review` flag was set broadly in Phase 2 for clusters",
              "  warranting human inspection.  The behavioral classification is still valid",
              "  and useful for pre-planning; only field deployment is gated.",
              "- **Recurrence as proxy for structural behaviour.**  A cluster appearing",
              "  on many days is classified STRUCTURAL, but this does not prove that",
              "  enforcement actions were tried and failed.  It may simply be chronically",
              "  under-patrolled.",
              "- **Cannot prove enforcement effectiveness.**  `action_taken_timestamp` and",
              "  `closed_datetime` are fully NULL — no enforcement outcome data exists to",
              "  validate whether RESPONSIVE clusters actually respond to tow deployment.",
              "- M3 and M18 joins add enrichment but are not required for Layer 1",
              "  behavioral classification.  Core rules depend only on recurrence features",
              "  from the handoff file.",
              "", "---", "", "## Final Recommendation", "",
              f"Corrected M4 outputs are {'ready' if all_pass else 'not yet ready'} to merge into Prakhar Phase 2.",
              "The two-layer design (behavioral type + deployment readiness) is the correct",
              "architecture for downstream use in M10 (VRP), M12 (Feedback), and the",
              "scored_hotspots schema.  REVIEW_FIRST clusters can still be ranked and",
              "pre-planned; they simply require operator sign-off before field deployment.",
              m3_note, m18_note]

    content = "\n".join(lines) + "\n"
    M4_REPORT.parent.mkdir(parents=True, exist_ok=True)
    M4_REPORT.write_text(content, encoding="utf-8")
    return content


def main_m4(verbose: bool = True) -> None:
    print("=" * 64)
    print("Prakhar Phase 2 — M4 Structural vs Responsive Classifier (v2)")
    print("=" * 64)
    print(f"\nInputs:")
    print(f"  {HANDOFF_PATH}")
    print(f"  {SUMMARY_PATH}")
    print(f"  {M3_PARQUET}  [{'present' if M3_PARQUET.exists() else 'MISSING'}]")
    print(f"  {M18_JC_PARQUET}  [{'present' if M18_JC_PARQUET.exists() else 'MISSING'}]")

    print("\nRunning M4 ...", flush=True)
    run_m4  = _get_m4_run()
    result  = run_m4(
        handoff_path=HANDOFF_PATH,
        summary_path=SUMMARY_PATH,
        peak_windows_path=M3_PARQUET,
        jurisdiction_path=M18_JC_PARQUET,
        out_parquet=M4_CL_PARQUET,
        out_csv=M4_CL_CSV,
    )
    summary = pd.read_parquet(SUMMARY_PATH)

    print(f"\nOutputs:")
    print(f"  {M4_CL_PARQUET}  [{M4_CL_PARQUET.exists()}]")
    print(f"  {M4_CL_CSV}  [{M4_CL_CSV.exists()}]")
    print(f"\nClusters processed: {len(result)}")

    print("\n--- Hotspot Type Distribution (behavioral) ---")
    print(result["hotspot_type"].value_counts().to_string())

    print("\n--- Deployment Readiness Distribution ---")
    print(result["deployment_readiness"].value_counts().to_string())

    print("\n--- needs_review_flag Distribution ---")
    print(result["needs_review_flag"].value_counts().to_string())

    print("\n--- Classification Confidence Distribution ---")
    print(result["classification_confidence"].value_counts().to_string())

    print("\n--- Top 10 Clusters by Violations ---")
    top10 = (result.sort_values("total_violations", ascending=False)
             .head(10)[["cluster_id", "assigned_station", "total_violations",
                         "hotspot_type", "deployment_readiness",
                         "classification_confidence"]])
    print(top10.to_string(index=False))

    print("\n--- Verification ---")
    checks   = verify_m4(result, summary)
    all_pass = True
    for check, passed in checks.items():
        if not passed:
            all_pass = False
        print(f"  [{'PASS' if passed else 'FAIL'}] {check}")
    print(f"\nOverall: {'ALL CHECKS PASS' if all_pass else 'SOME CHECKS FAILED'}")

    if verbose:
        print(f"\nGenerating report -> {M4_REPORT}")
        content = write_m4_report(result, summary, checks)
        print("\n" + "=" * 64 + "\nREPORT CONTENT:\n" + "=" * 64)
        print(content)


# ===========================================================================
# Merge section
# ===========================================================================

def verify_merge(result: pd.DataFrame, checks: list) -> dict[str, bool]:
    return {name: passed for name, passed, _ in checks}


def write_merge_report(result: pd.DataFrame, checks: list) -> str:
    summary    = pd.read_parquet(SUMMARY_PATH)
    pw         = pd.read_parquet(M3_PARQUET)
    jc         = pd.read_parquet(M18_JC_PARQUET)
    cl         = pd.read_parquet(M4_CL_PARQUET)

    n_clusters  = len(result)
    total_viol  = int(result["violation_count"].sum())
    n_cols      = len(result.columns)

    m3_cov  = result["recommended_patrol_window"].notna().sum()
    m18_cov = result["assigned_station"].notna().sum()
    m4_cov  = result["hotspot_type"].notna().sum()

    htype_dist  = result["hotspot_type"].value_counts().to_dict()
    ready_dist  = result["deployment_readiness"].value_counts().to_dict()
    band_dist   = result["station_priority_band"].value_counts().to_dict()
    tconf_dist  = result["temporal_confidence"].value_counts().to_dict()
    cconf_dist  = result["classification_confidence"].value_counts().to_dict()

    all_pass = all(passed for _, passed, _ in checks)
    verdict  = "PASS" if all_pass else (
        "CONDITIONAL PASS" if sum(p for _, p, _ in checks) >= len(checks) - 1
        else "FAIL")

    top20 = (result.sort_values("violation_count", ascending=False)
             .head(20)[["cluster_id", "assigned_station", "violation_count",
                         "peak_hour", "recommended_patrol_window",
                         "hotspot_type", "deployment_readiness",
                         "station_priority_band", "recommended_action"]])

    ready_n       = ready_dist.get("READY", 0)
    review_n      = ready_dist.get("REVIEW_FIRST", 0)

    identity_cols = [
        "cluster_id", "centroid_lat", "centroid_lng", "violation_count",
        "unique_vehicle_types", "dominant_vehicle_type", "vehicle_mix",
        "police_station_mode", "location_mode", "junction_name_mode",
        "junction_flag_rate", "has_junction_name_rate",
        "first_seen_ist", "last_seen_ist",
        "active_days", "active_weeks", "peak_hour_basic", "peak_day_basic",
        "h3_cells_count", "cluster_quality", "needs_manual_review",
    ]
    m3_cols  = [
        "peak_hour", "peak_hour_count", "peak_hour_share", "top_3_hours",
        "peak_day_name", "peak_day_type", "weekday_peak_hour", "weekend_peak_hour",
        "recommended_patrol_window", "secondary_patrol_window",
        "temporal_concentration_score", "temporal_confidence", "m3_notes",
    ]
    m18_cols = [
        "assigned_station", "station_assignment_method", "station_assignment_confidence",
        "station_cluster_rank", "station_violation_rank", "station_priority_band",
        "is_top_station_hotspot", "station_total_clusters", "station_total_violations",
        "station_needs_review_clusters", "station_good_clusters", "station_medium_clusters",
        "cluster_violation_share_within_station", "jurisdiction_notes",
    ]
    m4_cols  = [
        "observation_span_days", "recurrence_rate_days", "week_coverage_rate",
        "avg_violations_per_active_day", "max_daily_violations", "top_day_share",
        "weekend_share", "weekday_share",
        "hotspot_type", "needs_review_flag", "deployment_readiness", "review_reason",
        "primary_behavior_signal", "behavior_signal_strength",
        "recommended_action", "classification_confidence", "m4_reason", "m4_notes",
    ]
    helper_cols = [
        "handoff_ready", "handoff_warning",
        "prakhar_feature_version", "downstream_join_key",
    ]

    lines = [
        "# Prakhar Phase 2 — Merge Handoff Report", "",
        "## Verdict", "", f"**{verdict}**", "", "---", "",
        "## Purpose", "",
        "This file (`prakhar_cluster_features.parquet`) merges all Prakhar-side Phase 2",
        "features — M3 peak patrol windows, M18 jurisdiction scoping, and M4 behavioral",
        "classification — into a single, join-safe downstream handoff file.",
        "",
        "It is the canonical source of Prakhar-derived features for:",
        "- Piyush's M2 (LCLE scoring), M7 (BCI computation), M1 (ROI ranker)",
        "- The final dashboard hotspot cards",
        "- Any downstream API serving cluster metadata",
        "",
        "This module does **not** compute any new features.  It only joins, resolves",
        "column conflicts, adds handoff helper columns, and validates the result.",
        "", "---", "",
        "## Inputs Used", "",
        "| File | Rows |", "|------|------|",
        f"| `data/processed/cluster_summary.parquet` | {len(summary):,} clusters (base) |",
        f"| `data/processed/cluster_peak_windows.parquet` | {len(pw):,} rows (M3) |",
        f"| `data/processed/jurisdiction_clusters.parquet` | {len(jc):,} rows (M18) |",
        f"| `data/processed/cluster_classification.parquet` | {len(cl):,} rows (M4) |",
        "", "---", "",
        "## Outputs Created", "",
        "| File | Rows | Columns |", "|------|------|---------|",
        f"| `data/processed/prakhar_cluster_features.parquet` | {n_clusters} | {n_cols} |",
        f"| `data/processed/prakhar_cluster_features.csv` | {n_clusters} | {n_cols} |",
        "", "---", "",
        "## Merge Method", "",
        "- `cluster_summary.parquet` is used as the **base table** (1 row per cluster).",
        "- Three **left joins** on `cluster_id`: M3, M18, M4 in sequence.",
        "- **No cluster_id is modified.**  All 1,084 cluster IDs pass through unchanged.",
        "- **Duplicate columns** across inputs are resolved by explicit column selection",
        "  before joining — no pandas `_x`/`_y` suffixes are ever generated.",
        "- Each shared column is taken from the **canonical source** (see module docstring).",
        "- **No final ROI scoring is done here** — this file feeds into Piyush's pipeline.",
        "", "---", "",
        "## Final Schema Summary", "",
        f"**Total columns:** {n_cols}", "",
        "**Identity / location (from cluster_summary):**",
        f"`{'`, `'.join(c for c in identity_cols if c in result.columns)}`", "",
        "**M3 timing (from cluster_peak_windows):**",
        f"`{'`, `'.join(c for c in m3_cols if c in result.columns)}`", "",
        "**M18 jurisdiction (from jurisdiction_clusters):**",
        f"`{'`, `'.join(c for c in m18_cols if c in result.columns)}`", "",
        "**M4 classification (from cluster_classification):**",
        f"`{'`, `'.join(c for c in m4_cols if c in result.columns)}`", "",
        "**Handoff helper columns (computed here):**",
        f"`{'`, `'.join(c for c in helper_cols if c in result.columns)}`",
        "", "---", "",
        "## Summary Metrics", "",
        f"- **Total clusters:** {n_clusters}",
        f"- **Total violations represented:** {total_viol:,}",
        f"- **M3 join coverage:** {m3_cov}/{n_clusters} ({m3_cov/n_clusters:.1%})",
        f"- **M18 join coverage:** {m18_cov}/{n_clusters} ({m18_cov/n_clusters:.1%})",
        f"- **M4 join coverage:** {m4_cov}/{n_clusters} ({m4_cov/n_clusters:.1%})", "",
        "**Hotspot type distribution (behavioral):**", "",
        "| Type | Clusters |", "|------|----------|",
    ]
    for ht in ["STRUCTURAL", "RESPONSIVE", "SEASONAL"]:
        lines.append(f"| {ht} | {htype_dist.get(ht, 0)} |")

    lines += ["", "**Deployment readiness distribution:**", "",
              "| Readiness | Clusters |", "|-----------|----------|"]
    for dr in ["READY", "REVIEW_FIRST"]:
        lines.append(f"| {dr} | {ready_dist.get(dr, 0)} |")

    lines += ["", "**Station priority band distribution:**", "",
              "| Band | Clusters |", "|------|----------|"]
    for b in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {b} | {band_dist.get(b, 0)} |")

    lines += ["", "**Temporal confidence distribution (M3):**", "",
              "| Confidence | Clusters |", "|------------|----------|"]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {tconf_dist.get(tier, 0)} |")

    lines += ["", "**Classification confidence distribution (M4):**", "",
              "| Confidence | Clusters |", "|------------|----------|"]
    for tier in ["HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {tier} | {cconf_dist.get(tier, 0)} |")

    lines += ["", "---", "", "## Top 20 Handoff Clusters", "",
              "| cluster_id | assigned_station | violation_count | peak_hour |"
              " recommended_patrol_window | hotspot_type | deployment_readiness |"
              " station_priority_band | recommended_action |",
              "|------------|-----------------|----------------|-----------|"
              "--------------------------|-------------|---------------------|"
              "----------------------|-------------------|"]
    for _, row in top20.iterrows():
        action_short = str(row["recommended_action"])[:60]
        lines.append(
            f"| {row.cluster_id} | {row.assigned_station} | {row.violation_count:,} |"
            f" {int(row.peak_hour)} | {row.recommended_patrol_window} |"
            f" {row.hotspot_type} | {row.deployment_readiness} |"
            f" {row.station_priority_band} | {action_short} |")

    lines += ["", "---", "", "## Ready vs Review-First Summary", "",
              f"| Category | Clusters | Explanation |",
              "|----------|----------|-------------|",
              f"| READY | {ready_n} | Cleared for direct downstream planning and field deployment |",
              f"| REVIEW_FIRST | {review_n} | Rank and pre-plan allowed; field deployment needs operator/geographic sign-off |",
              "", "**READY** clusters have `needs_review_flag = 0` — their geographic boundaries",
              "were confirmed clean in Phase 2, and their behavioral classification is based",
              "on sufficient temporal evidence.  They can be fed directly into VRP routing",
              "and patrol scheduling.", "",
              "**REVIEW_FIRST** clusters still carry a full behavioral `hotspot_type`",
              "(STRUCTURAL/RESPONSIVE/SEASONAL) so downstream scoring can pre-rank them,",
              "but the `recommended_action` is prefixed with 'Review geography first;'.",
              "An operator must inspect the cluster boundary or station assignment before",
              "dispatching enforcement resources.",
              "", "---", "", "## Verification Checks", "",
              "| Check | Status | Detail |", "|-------|--------|--------|"]
    for name, passed, detail in checks:
        status = "PASS" if passed else "FAIL"
        lines.append(f"| {name.replace('_', ' ')} | {status} | {detail} |")

    lines += ["", "---", "", "## Limitations", "",
              "- **Feature handoff only — no ROI scoring done here.**  This file feeds",
              "  Piyush's M2/M7/M1 pipeline.  The final `scored_hotspots.parquet` adds",
              "  road capacity (OSM), BCI, and LCLE enforcement scores on top of these features.",
              "- **No road-capacity / BCI / LCLE columns.**  Those come from Piyush's",
              "  `04_enrich_osm.py` and `05_score.py` modules, which join on `cluster_id`.",
              "- **REVIEW_FIRST clusters require human sign-off before field deployment.**",
              "  The behavioral classification is valid and useful; only actual patrol",
              "  dispatch is gated until an operator confirms the geography.",
              "- **No enforcement outcome validation.**  `action_taken_timestamp` and",
              "  `closed_datetime` are fully NULL in the source dataset — no feedback loop",
              "  exists until M12 (Feedback Loop) is implemented.",
              "- **Station assignment is FTVR-observed** (`police_station_mode`), not legal",
              "  boundary mapping.  Clusters that span multiple station areas may be",
              "  assigned to the most frequently observed station only.",
              "", "---", "", "## Final Recommendation", "",
              f"Prakhar's merged feature file is {'ready' if all_pass else 'not yet ready'} for handoff to Piyush.",
              "Join on `cluster_id` (or equivalently `downstream_join_key`).",
              "All Prakhar-side features — peak timing, jurisdiction, and behavioral",
              "classification — are available in one place with no suffix ambiguity.",
              f"File: `data/processed/prakhar_cluster_features.parquet` ({n_clusters} rows, {n_cols} columns)."]

    content = "\n".join(lines) + "\n"
    MERGE_REPORT.parent.mkdir(parents=True, exist_ok=True)
    MERGE_REPORT.write_text(content, encoding="utf-8")
    return content


def main_merge(verbose: bool = True) -> None:
    print("=" * 64)
    print("Prakhar Phase 2 — Merge Handoff (03c)")
    print("=" * 64)
    print(f"\nInputs:")
    print(f"  {SUMMARY_PATH}       [{SUMMARY_PATH.exists()}]")
    print(f"  {M3_PARQUET}   [{M3_PARQUET.exists()}]")
    print(f"  {M18_JC_PARQUET}  [{M18_JC_PARQUET.exists()}]")
    print(f"  {M4_CL_PARQUET}   [{M4_CL_PARQUET.exists()}]")

    print("\nRunning merge ...", flush=True)
    merge_mod = _get_merge_module()
    result, checks = merge_mod.run(
        summary_path=SUMMARY_PATH,
        peak_win_path=M3_PARQUET,
        jurisdiction_path=M18_JC_PARQUET,
        classif_path=M4_CL_PARQUET,
        out_parquet=MERGE_PARQUET,
        out_csv=MERGE_CSV,
    )
    summary = pd.read_parquet(SUMMARY_PATH)

    print(f"\nOutputs:")
    print(f"  {MERGE_PARQUET}  [{MERGE_PARQUET.exists()}]")
    print(f"  {MERGE_CSV}  [{MERGE_CSV.exists()}]")
    print(f"\nClusters in output: {len(result)}")
    print(f"Columns in output:  {len(result.columns)}")

    m3_cov  = result["recommended_patrol_window"].notna().sum()
    m18_cov = result["assigned_station"].notna().sum()
    m4_cov  = result["hotspot_type"].notna().sum()
    print(f"\nJoin coverage:")
    print(f"  M3  (recommended_patrol_window): {m3_cov}/{len(result)} ({m3_cov/len(result):.1%})")
    print(f"  M18 (assigned_station):          {m18_cov}/{len(result)} ({m18_cov/len(result):.1%})")
    print(f"  M4  (hotspot_type):              {m4_cov}/{len(result)} ({m4_cov/len(result):.1%})")

    print("\n--- Hotspot Type Distribution ---")
    print(result["hotspot_type"].value_counts().to_string())

    print("\n--- Deployment Readiness Distribution ---")
    print(result["deployment_readiness"].value_counts().to_string())

    print("\n--- Station Priority Band Distribution ---")
    print(result["station_priority_band"].value_counts().to_string())

    print("\n--- Top 10 Handoff Clusters by violation_count ---")
    top10 = (result.sort_values("violation_count", ascending=False)
             .head(10)[["cluster_id", "assigned_station", "violation_count",
                         "recommended_patrol_window", "hotspot_type",
                         "deployment_readiness", "station_priority_band"]])
    print(top10.to_string(index=False))

    print("\n--- Verification ---")
    chk_dict = verify_merge(result, checks)
    all_pass = True
    for check, passed in chk_dict.items():
        if not passed:
            all_pass = False
        print(f"  [{'PASS' if passed else 'FAIL'}] {check}")
    print(f"\nOverall: {'ALL CHECKS PASS' if all_pass else 'SOME CHECKS FAILED'}")

    if verbose:
        print(f"\nGenerating report -> {MERGE_REPORT}")
        content = write_merge_report(result, checks)
        print("\n" + "=" * 64 + "\nREPORT CONTENT:\n" + "=" * 64)
        print(content)


# ===========================================================================
# Entry point
# ===========================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prakhar Phase 2 runner")
    parser.add_argument("--m3",          action="store_true", help="Run M3 Peak Window Predictor")
    parser.add_argument("--m18",         action="store_true", help="Run M18 Jurisdiction Scoping")
    parser.add_argument("--m4",          action="store_true", help="Run M4 Hotspot Classifier")
    parser.add_argument("--merge",       action="store_true", help="Run Merge Handoff (03c)")
    parser.add_argument("--all-current", action="store_true",
                        help="Run M3 → M18 → M4 → merge in sequence")
    args = parser.parse_args()

    if args.all_current:
        main_m3(verbose=False)
        print()
        main_m18(verbose=False)
        print()
        main_m4(verbose=False)
        print()
        main_merge(verbose=True)
    elif args.m3:
        main_m3(verbose=True)
    elif args.m18:
        main_m18(verbose=True)
    elif args.m4:
        main_m4(verbose=True)
    elif args.merge:
        main_merge(verbose=True)
    else:
        print("No flag provided. Use --m3, --m18, --m4, --merge, or --all-current.")
        parser.print_help()
        sys.exit(1)
