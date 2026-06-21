"""
Final end-to-end validation across the entire parking intelligence pipeline.

Checks that outputs from P1 → P2 → P3 → P4 → M2 → M7 → M1 are internally
consistent and satisfy the data contracts.

Usage:
    python tests/final_end_to_end_validation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.officer.feedback_backend import get_feedback_summary_for_scoring

REPORT_PATH = PROJECT_ROOT / "reports" / "FINAL_END_TO_END_VALIDATION_REPORT.md"

SCHEMA_COLUMNS = [
    "cluster_id", "centroid_lat", "centroid_lng", "assigned_station", "border_flag",
    "road_class", "road_width_m", "osm_coverage", "violation_count", "vehicle_mix",
    "lcle_pct", "bci", "persistence", "recurrence", "peak_window", "roi_score",
    "classification", "recommended_action",
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


def check(name: str, condition: bool, detail: str = "") -> dict:
    return {"name": name, "passed": condition, "detail": detail}


def main() -> int:
    checks = []

    # ------------------------------------------------------------------
    # 1. File existence
    # ------------------------------------------------------------------
    required_files = {
        "cleaned_violations": PROJECT_ROOT / "data" / "processed" / "cleaned_violations.parquet",
        "clustered_violations": PROJECT_ROOT / "data" / "processed" / "clustered_violations.parquet",
        "cluster_summary": PROJECT_ROOT / "data" / "processed" / "cluster_summary.parquet",
        "prakhar_cluster_features": PROJECT_ROOT / "data" / "processed" / "prakhar_cluster_features.parquet",
        "enriched_clusters": PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet",
        "scored_hotspots": PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet",
        "bengaluru_graph": PROJECT_ROOT / "references" / "bengaluru_drive.graphml",
        "feedback_db": PROJECT_ROOT / "data" / "outputs" / "feedback.sqlite",
    }
    missing = [name for name, path in required_files.items() if not path.exists()]
    checks.append(check(
        "required_files_exist",
        len(missing) == 0,
        f"missing: {missing}" if missing else "all required files present",
    ))

    # ------------------------------------------------------------------
    # 2. Load key tables
    # ------------------------------------------------------------------
    try:
        cleaned = pd.read_parquet(required_files["cleaned_violations"])
        clustered = pd.read_parquet(required_files["clustered_violations"])
        summary = pd.read_parquet(required_files["cluster_summary"])
        prakhar = pd.read_parquet(required_files["prakhar_cluster_features"])
        enriched = pd.read_parquet(required_files["enriched_clusters"])
        scored = pd.read_parquet(required_files["scored_hotspots"])
        feedback = get_feedback_summary_for_scoring()
    except Exception as exc:
        checks.append(check("load_all_tables", False, str(exc)))
        return write_report(checks, {})

    # ------------------------------------------------------------------
    # 3. Row-count sanity
    # ------------------------------------------------------------------
    checks.append(check(
        "cleaned_not_empty",
        len(cleaned) > 0,
        f"{len(cleaned):,} rows",
    ))
    checks.append(check(
        "clustered_rows_le_cleaned",
        len(clustered) <= len(cleaned),
        f"clustered={len(clustered):,}, cleaned={len(cleaned):,}",
    ))
    checks.append(check(
        "summary_enriched_scored_same_row_count",
        len(summary) == len(enriched) == len(scored) == 1084,
        f"summary={len(summary)}, enriched={len(enriched)}, scored={len(scored)}",
    ))

    # ------------------------------------------------------------------
    # 4. cluster_id coverage
    # ------------------------------------------------------------------
    summary_ids = set(summary["cluster_id"])
    enriched_ids = set(enriched["cluster_id"])
    prakhar_ids = set(prakhar["cluster_id"])
    scored_ids = set(scored["cluster_id"])

    checks.append(check(
        "enriched_covers_all_summary_clusters",
        summary_ids == enriched_ids,
        f"overlap={len(summary_ids & enriched_ids)}, summary={len(summary_ids)}, enriched={len(enriched_ids)}",
    ))
    checks.append(check(
        "prakhar_covers_all_summary_clusters",
        summary_ids == prakhar_ids,
        f"overlap={len(summary_ids & prakhar_ids)}, summary={len(summary_ids)}, prakhar={len(prakhar_ids)}",
    ))
    checks.append(check(
        "scored_covers_all_summary_clusters",
        summary_ids == scored_ids,
        f"overlap={len(summary_ids & scored_ids)}, summary={len(summary_ids)}, scored={len(scored_ids)}",
    ))

    # ------------------------------------------------------------------
    # 5. No NOISE rows in final output
    # ------------------------------------------------------------------
    checks.append(check(
        "scored_has_no_noise",
        "NOISE" not in scored["cluster_id"].values,
        "NOISE found" if "NOISE" in scored["cluster_id"].values else "clean",
    ))

    # ------------------------------------------------------------------
    # 6. Schema compliance
    # ------------------------------------------------------------------
    missing_cols = [c for c in SCHEMA_COLUMNS if c not in scored.columns]
    extra_cols = [c for c in scored.columns if c not in SCHEMA_COLUMNS]
    checks.append(check(
        "scored_schema_columns",
        len(missing_cols) == 0,
        f"missing={missing_cols}, extra={extra_cols}",
    ))

    dtype_ok = True
    dtype_issues = []
    for col, expected in SCHEMA_DTYPES.items():
        if col in scored.columns:
            actual = str(scored[col].dtype)
            if actual != expected:
                dtype_ok = False
                dtype_issues.append(f"{col}: expected {expected}, got {actual}")
    checks.append(check(
        "scored_schema_dtypes",
        dtype_ok,
        "; ".join(dtype_issues) if dtype_issues else "all dtypes match",
    ))

    # ------------------------------------------------------------------
    # 7. Value ranges
    # ------------------------------------------------------------------
    checks.append(check(
        "roi_score_range_0_100",
        scored["roi_score"].between(0, 100).all(),
        f"min={scored['roi_score'].min():.4f}, max={scored['roi_score'].max():.4f}",
    ))
    checks.append(check(
        "lcle_range_0_100",
        scored["lcle_pct"].between(0, 100).all(),
        f"min={scored['lcle_pct'].min():.4f}, max={scored['lcle_pct'].max():.4f}",
    ))
    checks.append(check(
        "bci_range_0_1",
        scored["bci"].between(0, 1).all(),
        f"min={scored['bci'].min():.4f}, max={scored['bci'].max():.4f}",
    ))
    checks.append(check(
        "no_null_required_fields",
        scored[SCHEMA_COLUMNS].notna().all().all(),
        f"nulls per column:\n{scored[SCHEMA_COLUMNS].isna().sum().to_dict()}" if scored[SCHEMA_COLUMNS].isna().any().any() else "no nulls",
    ))

    # ------------------------------------------------------------------
    # 8. Cross-table consistency
    # ------------------------------------------------------------------
    merged_check = summary.merge(
        scored[["cluster_id", "violation_count"]], on="cluster_id", suffixes=("_summary", "_scored")
    )
    counts_match = (merged_check["violation_count_summary"] == merged_check["violation_count_scored"]).all()
    checks.append(check(
        "violation_count_consistent_summary_to_scored",
        counts_match,
        "counts match" if counts_match else "mismatch found",
    ))

    # ------------------------------------------------------------------
    # 9. Feedback loop closure
    # ------------------------------------------------------------------
    if "feedback_structural_boost" in enriched.columns:
        boosted_ids = set(enriched[enriched["feedback_structural_boost"] == 1]["cluster_id"])
        feedback_ids = set(feedback[feedback["feedback_structural_boost"] == 1]["cluster_id"])
        boosted_structural = scored[scored["cluster_id"].isin(boosted_ids)]["classification"] == "STRUCTURAL"
        checks.append(check(
            "feedback_boosted_clusters_are_structural",
            len(boosted_ids) == 0 or boosted_structural.all(),
            f"boosted={sorted(boosted_ids)}, structural={boosted_structural.all() if len(boosted_ids) else 'N/A'}",
        ))
        checks.append(check(
            "feedback_summary_matches_enriched_boost",
            boosted_ids == feedback_ids,
            f"enriched_boost={sorted(boosted_ids)}, feedback_boost={sorted(feedback_ids)}",
        ))
    else:
        checks.append(check("feedback_boosted_clusters_are_structural", False, "feedback_structural_boost missing in enriched"))
        checks.append(check("feedback_summary_matches_enriched_boost", False, "feedback_structural_boost missing in enriched"))

    # ------------------------------------------------------------------
    # 10. Classification / action sanity
    # ------------------------------------------------------------------
    valid_classes = {"STRUCTURAL", "RESPONSIVE", "SEASONAL"}
    checks.append(check(
        "classification_values_valid",
        set(scored["classification"].unique()).issubset(valid_classes),
        f"classes={set(scored['classification'].unique())}",
    ))

    class_action_pairs = scored[["classification", "recommended_action"]].drop_duplicates()
    valid_structural_actions = {
        "Recurring patrol + towing support + signage/infra review",
        "Review geography first; if confirmed, apply: Recurring patrol + towing support + signage/infra review",
    }
    structural_actions = set(scored[scored["classification"] == "STRUCTURAL"]["recommended_action"].unique())
    checks.append(check(
        "structural_clusters_have_structural_action",
        structural_actions.issubset(valid_structural_actions),
        f"unique structural actions: {sorted(structural_actions)}",
    ))

    # ------------------------------------------------------------------
    # 11. Distribution sanity
    # ------------------------------------------------------------------
    checks.append(check(
        "roi_has_spread",
        scored["roi_score"].std() > 0.001,
        f"std={scored['roi_score'].std():.4f}",
    ))
    checks.append(check(
        "lcle_has_spread",
        scored["lcle_pct"].std() > 0.001,
        f"std={scored['lcle_pct'].std():.4f}",
    ))
    checks.append(check(
        "peak_window_populated",
        (scored["peak_window"] != "UNKNOWN").sum() / len(scored) > 0.9,
        f"known={((scored['peak_window'] != 'UNKNOWN').sum() / len(scored) * 100):.1f}%",
    ))

    # ------------------------------------------------------------------
    # 12. Station assignment coverage
    # ------------------------------------------------------------------
    checks.append(check(
        "assigned_station_populated",
        (scored["assigned_station"] != "UNASSIGNED").sum() / len(scored) > 0.9,
        f"assigned={((scored['assigned_station'] != 'UNASSIGNED').sum() / len(scored) * 100):.1f}%",
    ))

    # ------------------------------------------------------------------
    # 13. Vehicle mix populated
    # ------------------------------------------------------------------
    checks.append(check(
        "vehicle_mix_populated",
        (scored["vehicle_mix"].astype(str).str.len() > 0).sum() / len(scored) > 0.9,
        f"populated={(((scored['vehicle_mix'].astype(str).str.len() > 0).sum() / len(scored)) * 100):.1f}%",
    ))

    return write_report(checks, {
        "cleaned_rows": len(cleaned),
        "clustered_rows": len(clustered),
        "summary_rows": len(summary),
        "scored_rows": len(scored),
        "structural_count": int((scored["classification"] == "STRUCTURAL").sum()),
        "responsive_count": int((scored["classification"] == "RESPONSIVE").sum()),
        "seasonal_count": int((scored["classification"] == "SEASONAL").sum()),
        "roi_mean": float(scored["roi_score"].mean()),
        "roi_median": float(scored["roi_score"].median()),
        "lcle_mean": float(scored["lcle_pct"].mean()),
        "bci_mean": float(scored["bci"].mean()),
    })


def write_report(checks: list[dict], stats: dict) -> int:
    all_pass = all(c["passed"] for c in checks)

    lines = [
        "# Final End-to-End Validation Report",
        "",
        "This report validates consistency across the entire pipeline: P1 → P2 → P3 → P4 → M2 → M7 → M1.",
        "",
        "## Summary",
        "",
        f"- Overall verdict: **{'PASS' if all_pass else 'FAIL'}**",
        f"- Checks passed: {sum(c['passed'] for c in checks)} / {len(checks)}",
        "",
        "## Pipeline stats",
        "",
    ]
    for key, val in stats.items():
        if isinstance(val, float):
            lines.append(f"- {key}: {val:.4f}")
        else:
            lines.append(f"- {key}: {val:,}")

    lines.extend([
        "",
        "## Checks",
        "",
        "| # | check | status | detail |",
        "|---|-------|--------|--------|",
    ])
    for i, c in enumerate(checks, start=1):
        status = "PASS" if c["passed"] else "FAIL"
        detail = str(c["detail"]).replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {i} | {c['name']} | {status} | {detail} |")

    lines.append("")
    lines.append("## Conclusion")
    lines.append("")
    if all_pass:
        lines.append("All end-to-end checks passed. The pipeline outputs are internally consistent and ready for demo/deployment.")
    else:
        lines.append("Some checks failed. Review the FAIL rows above before demo/deployment.")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"[final_e2e] Report written: {REPORT_PATH}")

    for c in checks:
        print(f"  {'PASS' if c['passed'] else 'FAIL'}: {c['name']}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
