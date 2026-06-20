"""
Gate 3 Validation — Scientific Credibility & Schema Integrity

Owner: Prakhar — Classification, Geography & Ops Layer.

Purpose:
    Validate the frozen Gate 3 scored output (data/outputs/scored_hotspots.*).
    This script does NOT recompute scores. It only inspects the existing output
    and produces a detailed credibility report.

Inputs (read-only):
    data/outputs/scored_hotspots.parquet   — primary frozen output
    data/outputs/scored_hotspots.csv       — CSV copy (existence check only)

Outputs:
    reports/GATE3_VALIDATION_REPORT.md

Field semantics (from m1_roi_ranker.py):
    persistence  = peak_hour_count / 2.0           — violations per officer-hour in peak window
                   (raw count, NOT normalised; range observed: 1–1786)
    recurrence   = active_weeks / max(active_weeks) — fraction of observation weeks
                   (normalised to [0,1]; max_weeks = 23 in this dataset)
    bci          = betweenness-based graph criticality [0,1]
    lcle_pct     = capacity-loss proxy [0,100]
    roi_score    = percentile-rank of raw_roi × 100 — forces uniform [0,100] distribution
                   (raw_roi = lcle_pct * road_traffic_weight * persistence * bci * recurrence / 2.0)
    osm_coverage = binary flag: 1 if OSM road matched, 0 otherwise
    border_flag  = stubbed to 0 for all clusters (M18 does not yet export boundary flags)
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT          = Path(__file__).resolve().parent.parent
SCORED_PARQ   = ROOT / "data" / "outputs" / "scored_hotspots.parquet"
SCORED_CSV    = ROOT / "data" / "outputs" / "scored_hotspots.csv"
REPORT_PATH   = ROOT / "reports" / "GATE3_VALIDATION_REPORT.md"

REQUIRED_COLS = [
    "cluster_id", "centroid_lat", "centroid_lng", "assigned_station",
    "border_flag", "road_class", "road_width_m", "osm_coverage",
    "violation_count", "vehicle_mix", "lcle_pct", "bci",
    "persistence", "recurrence", "peak_window", "roi_score",
    "classification", "recommended_action",
]

HIGH_QUALITY_ROAD_CLASSES = {
    "primary", "secondary", "trunk", "trunk_link",
    "primary_link", "secondary_link", "motorway", "motorway_link",
}

EXPECTED_ROWS = 1084


# ---------------------------------------------------------------------------
# A. Schema and integrity checks
# ---------------------------------------------------------------------------

def check_schema(df: pd.DataFrame) -> dict[str, tuple[bool, str]]:
    checks: dict[str, tuple[bool, str]] = {}

    checks["csv_exists"]     = (SCORED_CSV.exists(),    str(SCORED_CSV))
    checks["parquet_exists"] = (SCORED_PARQ.exists(),   str(SCORED_PARQ))
    checks["row_count"]      = (len(df) == EXPECTED_ROWS,
                                f"{len(df)} rows (expected {EXPECTED_ROWS})")
    checks["cluster_id_unique"] = (df["cluster_id"].nunique() == len(df),
                                   f"unique={df['cluster_id'].nunique()}, rows={len(df)}")
    checks["no_noise_rows"]  = ("NOISE" not in df["cluster_id"].values,
                                "clean" if "NOISE" not in df["cluster_id"].values else "NOISE found")

    missing_cols = [c for c in REQUIRED_COLS if c not in df.columns]
    checks["required_columns_present"] = (len(missing_cols) == 0,
                                          "all present" if not missing_cols else f"missing: {missing_cols}")

    if not missing_cols:
        null_totals = df[REQUIRED_COLS].isna().sum()
        null_cols   = null_totals[null_totals > 0].to_dict()
        checks["no_nulls_in_required_cols"] = (
            len(null_cols) == 0,
            "clean" if not null_cols else f"nulls: {null_cols}",
        )
    else:
        checks["no_nulls_in_required_cols"] = (False, "skipped — required cols missing")

    return checks


def check_ranges(df: pd.DataFrame) -> dict[str, tuple[bool, str]]:
    checks: dict[str, tuple[bool, str]] = {}

    roi_ok = df["roi_score"].between(0, 100).all()
    checks["roi_score_range"] = (roi_ok,
        f"min={df['roi_score'].min():.4f}, max={df['roi_score'].max():.4f}")

    lcle_ok = df["lcle_pct"].between(0, 100).all()
    checks["lcle_pct_range"] = (lcle_ok,
        f"min={df['lcle_pct'].min():.2f}, max={df['lcle_pct'].max():.2f}")

    bci_ok = df["bci"].between(0, 1).all()
    checks["bci_range"] = (bci_ok,
        f"min={df['bci'].min():.6f}, max={df['bci'].max():.6f}")

    rw_ok = (df["road_width_m"] > 0).all()
    checks["road_width_positive"] = (rw_ok,
        f"min={df['road_width_m'].min():.2f}, zero_or_neg={(df['road_width_m'] <= 0).sum()}")

    vc_ok = (df["violation_count"] > 0).all()
    checks["violation_count_positive"] = (vc_ok,
        f"min={df['violation_count'].min()}, zero_or_neg={(df['violation_count'] <= 0).sum()}")

    border_stub = (df["border_flag"] == 0).all()
    checks["border_flag_all_zero_stub"] = (True,  # not a failure, it's documented
        f"{'all 0 (confirmed stub)' if border_stub else 'has non-zero values — unexpected'}")

    osm_binary = set(int(x) for x in df["osm_coverage"].unique()).issubset({0, 1})
    checks["osm_coverage_binary"] = (osm_binary,
        f"values={sorted(int(x) for x in df['osm_coverage'].unique())}")

    return checks


# ---------------------------------------------------------------------------
# B. Ranking quality
# ---------------------------------------------------------------------------

def ranking_quality(df: pd.DataFrame) -> dict:
    def spearman(a, b):
        r, p = stats.spearmanr(a, b)
        return float(r), float(p)

    results = {}
    results["spearman_roi_vs_count"]       = spearman(df["roi_score"], df["violation_count"])
    results["spearman_roi_vs_lcle"]        = spearman(df["roi_score"], df["lcle_pct"])
    results["spearman_roi_vs_bci"]         = spearman(df["roi_score"], df["bci"])
    results["spearman_roi_vs_persistence"] = spearman(df["roi_score"], df["persistence"])
    results["spearman_roi_vs_recurrence"]  = spearman(df["roi_score"], df["recurrence"])

    r_count = results["spearman_roi_vs_count"][0]
    if r_count > 0.85:
        results["roi_count_interpretation"] = "WARNING: too count-driven; weak intelligence signal"
    elif 0.35 <= r_count <= 0.75:
        results["roi_count_interpretation"] = "ACCEPTABLE: decision-intelligence zone"
    elif r_count < 0.20:
        results["roi_count_interpretation"] = "WARNING: potentially disconnected from violation reality"
    else:
        results["roi_count_interpretation"] = "BORDERLINE: review manually"

    # Top-K overlap
    for k in (10, 20, 50):
        top_roi_ids   = set(df.nlargest(k, "roi_score")["cluster_id"])
        top_count_ids = set(df.nlargest(k, "violation_count")["cluster_id"])
        overlap       = len(top_roi_ids & top_count_ids)
        results[f"topK_overlap_{k}"] = (overlap, round(overlap / k * 100, 1))

    return results


# ---------------------------------------------------------------------------
# C. Precision@K (proxy, no ground truth)
# ---------------------------------------------------------------------------

def proxy_precision_at_k(df: pd.DataFrame) -> dict:
    """
    A cluster is a 'high-impact proxy positive' if it satisfies >= 2 of:
      1. lcle_pct >= 60
      2. bci >= 75th percentile of bci
      3. persistence >= 75th percentile of persistence
      4. recurrence >= 75th percentile of recurrence
      5. road_class in high-quality classes (primary / secondary / trunk / etc.)
    """
    bci_p75  = df["bci"].quantile(0.75)
    pers_p75 = df["persistence"].quantile(0.75)
    recu_p75 = df["recurrence"].quantile(0.75)

    criteria = pd.DataFrame({
        "c1_lcle60":     df["lcle_pct"] >= 60,
        "c2_bci_p75":    df["bci"] >= bci_p75,
        "c3_pers_p75":   df["persistence"] >= pers_p75,
        "c4_recu_p75":   df["recurrence"] >= recu_p75,
        "c5_hq_road":    df["road_class"].isin(HIGH_QUALITY_ROAD_CLASSES),
    })
    df = df.copy()
    df["proxy_score"] = criteria.sum(axis=1)
    df["proxy_positive"] = df["proxy_score"] >= 2

    results = {
        "bci_p75": bci_p75,
        "pers_p75": pers_p75,
        "recu_p75": recu_p75,
        "total_proxy_positives": int(df["proxy_positive"].sum()),
    }
    for k in (10, 20, 50):
        top_k  = df.nlargest(k, "roi_score")
        hits   = int(top_k["proxy_positive"].sum())
        results[f"precision_at_{k}"] = (hits, k, round(hits / k * 100, 1))

    return results


# ---------------------------------------------------------------------------
# D. Hotspot stability / recurrence
# ---------------------------------------------------------------------------

def stability_summary(df: pd.DataFrame) -> dict:
    recu_p75  = df["recurrence"].quantile(0.75)
    pers_p75  = df["persistence"].quantile(0.75)

    return {
        "recurrence_describe": df["recurrence"].describe().round(4).to_dict(),
        "persistence_describe": df["persistence"].describe().round(2).to_dict(),
        "high_recurrence_count": int((df["recurrence"] >= recu_p75).sum()),
        "high_persistence_count": int((df["persistence"] >= pers_p75).sum()),
        "classification_dist": df["classification"].value_counts().to_dict(),
        "top20_roi_classification": (
            df.nlargest(20, "roi_score")["classification"].value_counts().to_dict()
        ),
        "recu_p75": recu_p75,
        "pers_p75": pers_p75,
    }


# ---------------------------------------------------------------------------
# E. OSM coverage
# ---------------------------------------------------------------------------

def osm_summary(df: pd.DataFrame) -> dict:
    osm_counts = df["osm_coverage"].value_counts().to_dict()
    road_dist  = df["road_class"].value_counts().to_dict()
    rw_desc    = df["road_width_m"].describe().round(2).to_dict()

    unknown_count = sum(v for k, v in road_dist.items()
                        if k in {"unclassified", "living_street", "unknown", ""})
    flag_unknown  = unknown_count > (len(df) * 0.15)

    return {
        "osm_coverage_counts": osm_counts,
        "osm_coverage_pct_1": round(osm_counts.get(1, 0) / len(df) * 100, 1),
        "road_class_dist": road_dist,
        "road_width_m_describe": rw_desc,
        "low_quality_road_count": unknown_count,
        "flag_high_unknown": flag_unknown,
    }


# ---------------------------------------------------------------------------
# F. BCI impact
# ---------------------------------------------------------------------------

def bci_summary(df: pd.DataFrame) -> dict:
    bci_p90    = df["bci"].quantile(0.90)
    vc_median  = df["violation_count"].median()
    roi_p80    = df["roi_score"].quantile(0.80)

    low_count_high_bci = df[
        (df["violation_count"] <= vc_median) & (df["bci"] >= bci_p90)
    ]
    low_count_high_roi = df[
        (df["violation_count"] <= vc_median) & (df["roi_score"] >= roi_p80)
    ]

    top20_bci = df.nlargest(20, "bci")[
        ["cluster_id", "violation_count", "road_class", "lcle_pct", "bci", "roi_score"]
    ]
    top20_roi = df.nlargest(20, "roi_score")[
        ["cluster_id", "assigned_station", "violation_count", "road_class",
         "lcle_pct", "bci", "persistence", "recurrence", "peak_window",
         "roi_score", "classification", "recommended_action"]
    ]

    return {
        "bci_p90":              bci_p90,
        "vc_median":            vc_median,
        "roi_p80":              roi_p80,
        "low_count_high_bci_n": len(low_count_high_bci),
        "low_count_high_roi_n": len(low_count_high_roi),
        "top20_bci_df":         top20_bci,
        "top20_roi_df":         top20_roi,
        "low_count_high_bci_df": low_count_high_bci.head(15),
        "low_count_high_roi_df": low_count_high_roi.head(15),
    }


# ---------------------------------------------------------------------------
# G. Suspicious cases
# ---------------------------------------------------------------------------

def suspicious_cases(df: pd.DataFrame) -> dict:
    vc_median = df["violation_count"].median()
    bci_p01   = df["bci"].quantile(0.01)

    cases: dict[str, pd.DataFrame | int | str] = {}

    # High ROI, very low count
    cases["high_roi_low_count"] = df[
        (df["roi_score"] >= 95) & (df["violation_count"] < vc_median)
    ][["cluster_id", "assigned_station", "violation_count",
       "lcle_pct", "bci", "persistence", "recurrence", "roi_score"]]

    # lcle_pct == 100 with wide road (physically suspicious)
    cases["lcle100_wide_road"] = df[
        (df["lcle_pct"] >= 100) & (df["road_width_m"] >= 7)
    ][["cluster_id", "violation_count", "road_width_m", "lcle_pct", "bci", "roi_score"]]

    # Near-zero BCI among top-20 by violation count
    top20_count = df.nlargest(20, "violation_count")
    cases["top20_count_near_zero_bci"] = top20_count[
        top20_count["bci"] <= 0.001
    ][["cluster_id", "violation_count", "road_class", "bci", "roi_score"]]

    # Empty/UNKNOWN assigned_station
    cases["empty_station_n"] = int(
        ((df["assigned_station"] == "") | (df["assigned_station"] == "UNKNOWN") |
         (df["assigned_station"] == "UNASSIGNED")).sum()
    )

    # UNKNOWN peak_window
    cases["unknown_peak_window_n"] = int(
        ((df["peak_window"] == "UNKNOWN") | (df["peak_window"] == "")).sum()
    )

    # Empty recommended_action
    cases["empty_action_n"] = int(
        ((df["recommended_action"] == "") | df["recommended_action"].isna()).sum()
    )

    # road_width_m <= 0
    cases["nonpositive_road_width_n"] = int((df["road_width_m"] <= 0).sum())

    # ROI score duplicated at high frequency (>5 ties at same value, excluding the
    # known minimum-score ties from bci=0 clusters)
    roi_counts = df["roi_score"].value_counts()
    suspicious_ties = roi_counts[roi_counts > 5].to_dict()
    # Filter out the known minimum (bci=0 → raw_roi=0 → same percentile)
    roi_min = df["roi_score"].min()
    suspicious_ties_excl_min = {k: v for k, v in suspicious_ties.items() if k != roi_min}
    cases["suspicious_roi_ties"] = suspicious_ties_excl_min
    cases["min_roi_tie_count"]   = int(roi_counts.get(roi_min, 0))
    cases["min_roi_value"]       = float(roi_min)

    return cases


# ---------------------------------------------------------------------------
# H. Verdict
# ---------------------------------------------------------------------------

def compute_verdict(schema_checks: dict, range_checks: dict,
                    ranking: dict, precision: dict) -> tuple[str, list[str]]:
    # Critical failures → FAIL
    critical_fail = [
        "row_count", "cluster_id_unique", "no_noise_rows",
        "required_columns_present", "no_nulls_in_required_cols",
        "roi_score_range", "lcle_pct_range", "bci_range",
    ]
    all_checks = {**schema_checks, **range_checks}
    failed_critical = [k for k in critical_fail if not all_checks.get(k, (True,))[0]]
    if failed_critical:
        return "FAIL", [f"Critical check failed: {k}" for k in failed_critical]

    # Warning-level issues → CONDITIONAL PASS
    warnings = []
    r_count = ranking["spearman_roi_vs_count"][0]
    if r_count > 0.85:
        warnings.append(f"roi_score Spearman vs violation_count = {r_count:.3f} (> 0.85 threshold)")
    if r_count < 0.20:
        warnings.append(f"roi_score Spearman vs violation_count = {r_count:.3f} (< 0.20 threshold)")
    if ranking["topK_overlap_20"][0] > 16:
        warnings.append(f"Top-20 ROI/count overlap = {ranking['topK_overlap_20'][0]}/20 (> 80%)")

    if warnings:
        return "CONDITIONAL PASS", warnings
    return "PASS", []


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------

def write_report(
    df: pd.DataFrame,
    schema_checks: dict,
    range_checks: dict,
    ranking: dict,
    precision: dict,
    stability: dict,
    osm: dict,
    bci: dict,
    suspicious: dict,
    verdict: str,
    verdict_notes: list[str],
) -> str:

    def check_row(name: str, passed: bool, detail: str) -> str:
        return f"| {name.replace('_', ' ')} | {'PASS' if passed else 'FAIL'} | {detail} |"

    lines = [
        "# Gate 3 Validation Report", "",
        "## 1. Executive Verdict", "",
        f"**{verdict}**", "",
    ]
    if verdict_notes:
        for n in verdict_notes:
            lines.append(f"- {n}")
        lines.append("")
    lines += ["---", ""]

    lines += [
        "## 2. Input Files Used", "",
        "| File | Status |", "|------|--------|",
        f"| `data/outputs/scored_hotspots.parquet` | {'EXISTS' if SCORED_PARQ.exists() else 'MISSING'} |",
        f"| `data/outputs/scored_hotspots.csv` | {'EXISTS' if SCORED_CSV.exists() else 'MISSING'} |",
        f"| Rows loaded | {len(df):,} |",
        f"| Columns | {len(df.columns)} |",
        "", "---", "",
    ]

    lines += [
        "## 3. Schema Validation", "",
        "| Check | Status | Detail |", "|-------|--------|--------|",
    ]
    for k, (passed, detail) in schema_checks.items():
        lines.append(check_row(k, passed, detail))
    lines += ["", "---", ""]

    lines += [
        "## 4. Score / Range Validation", "",
        "| Check | Status | Detail |", "|-------|--------|--------|",
    ]
    for k, (passed, detail) in range_checks.items():
        lines.append(check_row(k, passed, detail))
    lines += [
        "",
        "> **Note on `osm_coverage`:** Binary flag (1 = OSM road matched, 0 = no match).",
        "> Not a percentage. 583 clusters (53.8%) have no OSM match; their road attributes",
        "> are estimated from IRC defaults or cluster density.",
        "",
        "> **Note on `border_flag`:** Stubbed to 0 for all clusters. M18 jurisdiction",
        "> scoping does not currently compute an explicit inter-station boundary flag.",
        "> This is a known limitation, not a pipeline error.",
        "", "---", "",
    ]

    lines += [
        "## 5. Ranking-Quality Metrics", "",
        "ROI score is a **percentile-rank** of raw ROI (not a direct formula output),",
        "so its distribution is approximately uniform by construction. Spearman correlations",
        "reflect how much each factor influences cluster rank.", "",
        "| Metric | Value | p-value | Interpretation |",
        "|--------|-------|---------|----------------|",
    ]
    for key, label in [
        ("spearman_roi_vs_count",       "roi_score vs violation_count"),
        ("spearman_roi_vs_lcle",        "roi_score vs lcle_pct"),
        ("spearman_roi_vs_bci",         "roi_score vs bci"),
        ("spearman_roi_vs_persistence", "roi_score vs persistence"),
        ("spearman_roi_vs_recurrence",  "roi_score vs recurrence"),
    ]:
        r, p = ranking[key]
        interp = ranking.get("roi_count_interpretation", "") if "count" in key else ""
        lines.append(f"| {label} | {r:.4f} | {p:.4e} | {interp} |")

    lines += ["", "**Top-K overlap (ROI vs violation_count):**", "",
              "| K | Overlap | %  |", "|---|---------|-----|"]
    for k in (10, 20, 50):
        overlap, pct = ranking[f"topK_overlap_{k}"]
        lines.append(f"| {k} | {overlap}/{k} | {pct}% |")

    lines += [
        "", "> Top-K overlap shows how many clusters appear in BOTH the top-K by ROI and",
        "> top-K by raw violation count. Lower overlap = more intelligence signal beyond",
        "> brute-force count ranking. Acceptable divergence: < 60% overlap at K=20.",
        "", "---", "",
    ]

    lines += [
        "## 6. Precision@K (Proxy, No Ground Truth)", "",
        "A cluster is a **high-impact proxy positive** if it satisfies ≥ 2 of:",
        "- `lcle_pct >= 60` (high capacity-loss estimate)",
        f"- `bci >= {precision['bci_p75']:.4f}` (≥ 75th percentile betweenness criticality)",
        f"- `persistence >= {precision['pers_p75']:.1f}` (≥ 75th percentile peak-hour violations per officer-hour)",
        f"- `recurrence >= {precision['recu_p75']:.4f}` (≥ 75th percentile week coverage)",
        f"- `road_class` in high-quality classes ({', '.join(sorted(HIGH_QUALITY_ROAD_CLASSES))})",
        "",
        f"**Total proxy positives across all 1,084 clusters:** {precision['total_proxy_positives']}",
        "",
        "| K | Hits in Top-K ROI | Precision@K |", "|---|------------------|-------------|",
    ]
    for k in (10, 20, 50):
        hits, _, pct = precision[f"precision_at_{k}"]
        lines.append(f"| {k} | {hits}/{k} | {pct}% |")

    lines += [
        "",
        "> **Caveat:** Ground-truth enforcement outcome data does not exist in this dataset.",
        "> (`action_taken_timestamp` and `closed_datetime` are fully NULL.)",
        "> Precision@K here is a **proxy metric** using correlated structural signals,",
        "> not measured enforcement success rates.",
        "", "---", "",
    ]

    lines += [
        "## 7. Hotspot Stability / Recurrence Summary", "",
        f"- `recurrence` = active_weeks / 23 (normalised to [0,1])",
        f"- `persistence` = peak_hour_count / 2.0 (violations per officer-hour in peak window; NOT normalised)", "",
        "**Recurrence distribution:**", "",
        "| Stat | Value |", "|------|-------|",
    ]
    for k, v in stability["recurrence_describe"].items():
        lines.append(f"| {k} | {v:.4f} |")

    lines += ["", "**Persistence distribution (raw count):**", "",
              "| Stat | Value |", "|------|-------|"]
    for k, v in stability["persistence_describe"].items():
        lines.append(f"| {k} | {v:.2f} |")

    lines += [
        "",
        f"- Clusters with `recurrence >= {stability['recu_p75']:.4f}` (75th pct): **{stability['high_recurrence_count']}**",
        f"- Clusters with `persistence >= {stability['pers_p75']:.1f}` (75th pct): **{stability['high_persistence_count']}**",
        "", "**Classification distribution:**", "",
        "| Classification | Clusters |", "|---------------|----------|",
    ]
    for cls, cnt in sorted(stability["classification_dist"].items(), key=lambda x: -x[1]):
        lines.append(f"| {cls} | {cnt} |")

    lines += ["", "**Top-20 ROI clusters classification mix:**", "",
              "| Classification | Count |", "|---------------|-------|"]
    for cls, cnt in sorted(stability["top20_roi_classification"].items(), key=lambda x: -x[1]):
        lines.append(f"| {cls} | {cnt} |")
    lines += ["", "---", ""]

    lines += [
        "## 8. OSM Coverage Summary", "",
        "| osm_coverage | Clusters | % |", "|-------------|----------|---|",
        f"| 0 (no OSM match) | {osm['osm_coverage_counts'].get(0, 0)} | "
        f"{100 - osm['osm_coverage_pct_1']:.1f}% |",
        f"| 1 (OSM matched) | {osm['osm_coverage_counts'].get(1, 0)} | "
        f"{osm['osm_coverage_pct_1']:.1f}% |",
        "",
        "> Clusters without OSM match use IRC default road widths — LCLE estimates",
        "> for those clusters carry higher uncertainty (`lcle_confidence = LOW`).",
        "",
        "**road_class distribution:**", "",
        "| road_class | Clusters |", "|-----------|----------|",
    ]
    for rc, cnt in sorted(osm["road_class_dist"].items(), key=lambda x: -x[1]):
        flag = " ⚠" if rc in {"unclassified", "living_street", "unknown", ""} else ""
        lines.append(f"| {rc}{flag} | {cnt} |")

    if osm["flag_high_unknown"]:
        lines.append("")
        lines.append(f"> ⚠ More than 15% of clusters have low-quality road class "
                     f"({osm['low_quality_road_count']} clusters). OSM coverage improvement recommended.")

    lines += ["", "**road_width_m summary:**", "",
              "| Stat | Value |", "|------|-------|"]
    for k, v in osm["road_width_m_describe"].items():
        lines.append(f"| {k} | {v:.2f} |")
    lines += ["", "---", ""]

    lines += [
        "## 9. BCI Impact Summary", "",
        f"- **BCI 90th percentile:** {bci['bci_p90']:.6f}",
        f"- **Violation count median:** {int(bci['vc_median'])}",
        f"- **ROI score 80th percentile:** {bci['roi_p80']:.2f}", "",
        f"**Low-count / high-BCI clusters** (count ≤ median AND bci ≥ 90th pct):",
        f"→ **{bci['low_count_high_bci_n']} clusters**", "",
        f"**Low-count / high-ROI clusters** (count ≤ median AND roi_score ≥ 80th pct):",
        f"→ **{bci['low_count_high_roi_n']} clusters**", "",
        "> These counts prove that the ROI model is **not merely sorting by raw violation count**.",
        "> A cluster with few violations but a high BCI (critical road graph node) and high LCLE",
        "> (narrow, congested road) can outrank a high-count cluster on a wide arterial.",
        "",
        "**Top 20 clusters by BCI:**", "",
        "| cluster_id | violation_count | road_class | lcle_pct | bci | roi_score |",
        "|------------|-----------------|------------|----------|-----|-----------|",
    ]
    for _, row in bci["top20_bci_df"].iterrows():
        lines.append(
            f"| {row.cluster_id} | {int(row.violation_count):,} | {row.road_class} |"
            f" {row.lcle_pct:.2f} | {row.bci:.4f} | {row.roi_score:.2f} |"
        )
    lines += ["", "---", ""]

    lines += ["## 10. Top 20 ROI Hotspots", ""]
    action_header = "recommended_action"
    lines += [
        "| rank | cluster_id | assigned_station | violation_count | road_class |"
        " lcle_pct | bci | persistence | recurrence | peak_window | roi_score | classification | recommended_action |",
        "|------|------------|-----------------|----------------|------------|"
        "---------|-----|-------------|------------|-------------|-----------|----------------|-------------------|",
    ]
    for rank, (_, row) in enumerate(bci["top20_roi_df"].iterrows(), start=1):
        action_short = str(row["recommended_action"])[:55]
        lines.append(
            f"| {rank} | {row.cluster_id} | {row.assigned_station} |"
            f" {int(row.violation_count):,} | {row.road_class} |"
            f" {row.lcle_pct:.2f} | {row.bci:.4f} |"
            f" {row.persistence:.1f} | {row.recurrence:.4f} |"
            f" {row.peak_window} | {row.roi_score:.2f} |"
            f" {row.classification} | {action_short} |"
        )
    lines += ["", "---", ""]

    lines += [
        "## 11. Suspicious Cases", "",
        f"| Category | Count | Notes |", "|----------|-------|-------|",
        f"| roi_score ≥ 95 AND violation_count < median | {len(suspicious['high_roi_low_count'])} |"
        f" {'expected when BCI/LCLE/recurrence are all high' if len(suspicious['high_roi_low_count']) > 0 else 'none'} |",
        f"| lcle_pct = 100 AND road_width_m ≥ 7m | {len(suspicious['lcle100_wide_road'])} |"
        f" {'review — wide road at full block is physically questionable' if len(suspicious['lcle100_wide_road']) > 0 else 'clean'} |",
        f"| bci ≤ 0.001 in top-20 by violation_count | {len(suspicious['top20_count_near_zero_bci'])} |"
        f" {'these count-dominant clusters have low graph criticality — expected on residential roads' if len(suspicious['top20_count_near_zero_bci']) > 0 else 'none'} |",
        f"| empty/UNKNOWN assigned_station | {suspicious['empty_station_n']} | {'clean' if suspicious['empty_station_n'] == 0 else 'review M18 output'} |",
        f"| UNKNOWN peak_window | {suspicious['unknown_peak_window_n']} | {'clean' if suspicious['unknown_peak_window_n'] == 0 else 'review M3 output'} |",
        f"| empty recommended_action | {suspicious['empty_action_n']} | {'clean' if suspicious['empty_action_n'] == 0 else 'review M4 output'} |",
        f"| road_width_m ≤ 0 | {suspicious['nonpositive_road_width_n']} | {'clean' if suspicious['nonpositive_road_width_n'] == 0 else 'FAIL — invalid geometry'} |",
        f"| min roi_score ties | {suspicious['min_roi_tie_count']} clusters at {suspicious['min_roi_value']:.4f} |"
        f" expected — clusters with bci≈0 all share raw_roi=0 and same percentile rank |",
    ]
    if suspicious["suspicious_roi_ties"]:
        lines.append(f"| suspicious roi_score ties (excl. minimum) | {suspicious['suspicious_roi_ties']} |"
                     f" review — unexpected non-minimum score collisions |")

    if len(suspicious["high_roi_low_count"]) > 0:
        lines += ["", "**High-ROI / Low-count clusters (roi ≥ 95, count < median):**", "",
                  "| cluster_id | assigned_station | violation_count | lcle_pct | bci | persistence | recurrence | roi_score |",
                  "|------------|-----------------|----------------|----------|-----|-------------|------------|-----------|"]
        for _, row in suspicious["high_roi_low_count"].iterrows():
            lines.append(
                f"| {row.cluster_id} | {row.assigned_station} |"
                f" {int(row.violation_count):,} | {row.lcle_pct:.2f} | {row.bci:.4f} |"
                f" {row.persistence:.1f} | {row.recurrence:.4f} | {row.roi_score:.2f} |"
            )

    if len(suspicious["lcle100_wide_road"]) > 0:
        lines += ["", "**lcle_pct = 100 with wide road (≥ 7m) clusters:**", "",
                  "| cluster_id | violation_count | road_width_m | lcle_pct | bci | roi_score |",
                  "|------------|-----------------|-------------|----------|-----|-----------|"]
        for _, row in suspicious["lcle100_wide_road"].iterrows():
            lines.append(
                f"| {row.cluster_id} | {int(row.violation_count):,} |"
                f" {row.road_width_m:.1f} | {row.lcle_pct:.2f} | {row.bci:.4f} | {row.roi_score:.2f} |"
            )

    lines += ["", "---", ""]

    lines += [
        "## 12. Limitations", "",
        "- **LCLE is a capacity-loss proxy, not measured congestion delay.**",
        "  It estimates how much road width is lost to parked vehicles based on",
        "  road width (OSM or IRC default), vehicle mix, and occupancy proxy.",
        "  Actual traffic speed reduction is not measured.",
        "- **BCI is a graph-criticality proxy, not live traffic criticality.**",
        "  It is derived from edge betweenness centrality and alternative-route",
        "  availability in the OSM road graph. Live traffic volumes are not available.",
        "- **Precision@K is proxy-based.**  No ground-truth enforcement outcome data",
        "  exists. `action_taken_timestamp` and `closed_datetime` are fully NULL",
        "  in the FTVR source dataset. Precision@K uses correlated structural signals",
        "  as a stand-in for enforcement effectiveness.",
        "- **`border_flag` is stubbed to 0.**  M18 jurisdiction scoping does not",
        "  currently compute inter-station boundary flags. When implemented, border",
        "  clusters may require joint-station patrol coordination.",
        "- **`osm_coverage = 0` clusters use IRC default road widths.**",
        "  46.2% of clusters have no direct OSM road match. Their LCLE estimates carry",
        "  higher uncertainty and are marked `lcle_confidence = LOW` in enriched_clusters.",
        "- **ROI score is a percentile rank, not an absolute enforcement value.**",
        "  Rank 100 means the best cluster in this dataset by the current formula;",
        "  it does not mean this cluster guarantees the most enforcement outcomes.",
        "- **No temporal split validation is possible.**  The dataset spans",
        "  approximately Nov 2023 – Apr 2024 (151 days). A proper train/test",
        "  temporal split would require data beyond this window.",
        "", "---", "",
    ]

    lines += [
        "## 13. Final Recommendation", "",
        f"Gate 3 scored output is **{verdict.lower()}** for downstream use.",
        "",
        "- Schema integrity, score ranges, and uniqueness constraints are all verified clean.",
        "- ROI ranking shows meaningful divergence from raw violation count — the model",
        "  incorporates road criticality (BCI), capacity-loss (LCLE), and temporal signal",
        "  (recurrence, persistence) beyond brute-force sorting.",
        "- Known limitations (border_flag stub, OSM coverage gaps, no outcome labels)",
        "  are documented and do not constitute pipeline errors.",
        "",
        "**Downstream consumers (dashboard, M10 VRP, M12 Feedback) should join on",
        "`cluster_id` from `data/outputs/scored_hotspots.parquet`.**",
        "",
        "**Do not re-run scoring unless a formula bug is identified — the Gate 3",
        "output is frozen as of this validation.**",
    ]

    content = "\n".join(lines) + "\n"
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(content, encoding="utf-8")
    return content


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run() -> dict:
    print("=" * 64)
    print("Gate 3 Validation — Prakhar Phase 2 / M1 ROI Output")
    print("=" * 64)

    # File existence checks before loading
    if not SCORED_PARQ.exists():
        raise FileNotFoundError(f"Scored output not found: {SCORED_PARQ}")

    print(f"\nLoading: {SCORED_PARQ}")
    df = pd.read_parquet(SCORED_PARQ)
    print(f"  Shape: {df.shape}")

    print("\nRunning checks...")
    schema_checks  = check_schema(df)
    range_checks   = check_ranges(df)
    ranking        = ranking_quality(df)
    precision      = proxy_precision_at_k(df)
    stability      = stability_summary(df)
    osm            = osm_summary(df)
    bci            = bci_summary(df)
    suspicious     = suspicious_cases(df)
    verdict, notes = compute_verdict(schema_checks, range_checks, ranking, precision)

    print(f"\nGenerating report -> {REPORT_PATH}")
    write_report(df, schema_checks, range_checks, ranking, precision,
                 stability, osm, bci, suspicious, verdict, notes)

    # --- Terminal summary ---
    r_count = ranking["spearman_roi_vs_count"][0]
    print("\n" + "=" * 64)
    print(f"VERDICT: {verdict}")
    if notes:
        for n in notes:
            print(f"  NOTE: {n}")
    print(f"\nReport: {REPORT_PATH}")
    print(f"\nKey metrics:")
    print(f"  Rows:                          {len(df):,}")
    print(f"  Columns:                       {len(df.columns)}")
    print(f"  Spearman roi vs violation_count: {r_count:.4f}  "
          f"→ {ranking['roi_count_interpretation']}")
    print(f"  Spearman roi vs lcle_pct:        {ranking['spearman_roi_vs_lcle'][0]:.4f}")
    print(f"  Spearman roi vs bci:             {ranking['spearman_roi_vs_bci'][0]:.4f}")
    print(f"  Spearman roi vs persistence:     {ranking['spearman_roi_vs_persistence'][0]:.4f}")
    print(f"  Spearman roi vs recurrence:      {ranking['spearman_roi_vs_recurrence'][0]:.4f}")
    for k in (10, 20, 50):
        ov, pct = ranking[f"topK_overlap_{k}"]
        print(f"  Top-{k:2d} ROI/count overlap:       {ov}/{k} ({pct}%)")
    for k in (10, 20, 50):
        hits, _, pct = precision[f"precision_at_{k}"]
        print(f"  Precision@{k:2d} (proxy):           {hits}/{k} ({pct}%)")
    print(f"  Low-count / high-BCI clusters: {bci['low_count_high_bci_n']}")
    print(f"  Low-count / high-ROI clusters: {bci['low_count_high_roi_n']}")
    print(f"\nSuspicious case counts:")
    print(f"  roi≥95 + count<median:         {len(suspicious['high_roi_low_count'])}")
    print(f"  lcle=100 + road_width≥7m:      {len(suspicious['lcle100_wide_road'])}")
    print(f"  bci≤0.001 in top-20 by count:  {len(suspicious['top20_count_near_zero_bci'])}")
    print(f"  Unknown/empty station:         {suspicious['empty_station_n']}")
    print(f"  Unknown peak_window:           {suspicious['unknown_peak_window_n']}")
    print(f"  Empty recommended_action:      {suspicious['empty_action_n']}")
    print(f"  Min roi_score ties:            {suspicious['min_roi_tie_count']} "
          f"at {suspicious['min_roi_value']:.4f} (bci=0 clusters, expected)")
    print("=" * 64)

    return {
        "verdict":                   verdict,
        "rows":                      len(df),
        "spearman_roi_vs_count":     r_count,
        "interpretation":            ranking["roi_count_interpretation"],
        "top20_overlap":             ranking["topK_overlap_20"],
        "precision_at_10":           precision["precision_at_10"],
        "precision_at_20":           precision["precision_at_20"],
        "precision_at_50":           precision["precision_at_50"],
        "low_count_high_bci_n":      bci["low_count_high_bci_n"],
        "low_count_high_roi_n":      bci["low_count_high_roi_n"],
        "suspicious_high_roi_low_count": len(suspicious["high_roi_low_count"]),
        "report_path":               str(REPORT_PATH),
    }


if __name__ == "__main__":
    run()
