"""
Module M4 — Structural vs Responsive Hotspot Classifier  (v2 — fixed design)

Owner: Prakhar — Classification, Geography & Ops Layer

Design principle (v2):
    Behavioral classification and deployment readiness are SEPARATE concerns.

    hotspot_type    — answers "what kind of behavior is this location showing?"
                      Values: STRUCTURAL | RESPONSIVE | SEASONAL

    deployment_readiness — answers "can we deploy enforcement here right now?"
                           Values: READY | REVIEW_FIRST

    The old v1 design used NEEDS_REVIEW as a hotspot_type override, which
    incorrectly mixed operational review flags with behavioral classification.
    v2 fixes this: every cluster gets a behavioral type, and separately a
    readiness flag that controls whether a human must inspect before deployment.

Inputs:
    data/processed/cluster_handoff_for_prakhar.parquet  — row-level IST timestamps
    data/processed/cluster_summary.parquet              — cluster-level reference
    data/processed/cluster_peak_windows.parquet         — M3 output (optional)
    data/processed/jurisdiction_clusters.parquet        — M18 output (optional)

Outputs:
    data/processed/cluster_classification.parquet
    data/processed/cluster_classification.csv

Output schema (one row per real cluster_id):
    cluster_id, total_violations, active_days, active_weeks,
    observation_span_days, recurrence_rate_days, week_coverage_rate,
    avg_violations_per_active_day, max_daily_violations, top_day_share,
    weekend_share, weekday_share,
    peak_hour, peak_hour_share, temporal_concentration_score,
    assigned_station, station_priority_band,
    cluster_quality, needs_manual_review,
    hotspot_type,
    needs_review_flag, deployment_readiness, review_reason,
    primary_behavior_signal, behavior_signal_strength,
    recommended_action, classification_confidence,
    m4_reason, m4_notes

Behavioral classification (applied in priority order, independent of review flags):

  1. STRUCTURAL — persistent, repeatedly recurring problem
     Rule A: active_days >= 30 AND active_weeks >= 8
     Rule B: recurrence_rate_days >= 0.25 AND active_weeks >= 6
     Signal: recurrent_across_weeks

  2. SEASONAL — day-of-week / weekend-skewed pattern
     Trigger (only if not STRUCTURAL):
       a. weekend_share >= 0.45
       b. peak_day_type == "WEEKEND" (from M3)
     Signal: weekend_dominant

  3. RESPONSIVE — bursty, moderate, or sparse hotspot (default)
     Trigger: everything not STRUCTURAL or SEASONAL.
     Also explicit if top_day_share >= 0.35 (single-day burst)
       or active_days < 14 AND total_violations >= 50.
     Sparse/low-signal clusters also fall here with confidence = LOW.
     Signal: burst_or_short_term | sparse_low_signal

Deployment readiness layer:
  needs_review_flag = 1  if needs_manual_review == 1
                         OR cluster_quality == "needs_review"
  deployment_readiness   = REVIEW_FIRST if needs_review_flag == 1
                         = READY        otherwise
  review_reason: human-readable explanation of why review is needed.

Recommended action:
  Base action is determined by hotspot_type.
  If deployment_readiness == REVIEW_FIRST:
    "Review geography first; if confirmed, apply: <base action>"
  If deployment_readiness == READY:
    base action directly.

Confidence / signal strength:
  HIGH   : total_violations >= 100 AND active_days >= 14
           AND (recurrence_rate_days >= 0.15 OR top_day_share >= 0.25)
  MEDIUM : total_violations >= 30 OR active_days >= 7   (and not HIGH)
  LOW    : everything else (sparse or weak signal)
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
HANDOFF_PATH      = ROOT / "data" / "processed" / "cluster_handoff_for_prakhar.parquet"
SUMMARY_PATH      = ROOT / "data" / "processed" / "cluster_summary.parquet"
PEAK_WINDOWS_PATH = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
JURISDICTION_PATH = ROOT / "data" / "processed" / "jurisdiction_clusters.parquet"
OUT_PARQUET       = ROOT / "data" / "processed" / "cluster_classification.parquet"
OUT_CSV           = ROOT / "data" / "processed" / "cluster_classification.csv"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BASE_ACTION = {
    "STRUCTURAL": "Recurring patrol + towing support + signage/infra review",
    "RESPONSIVE": "Targeted short-term patrol during peak window",
    "SEASONAL":   "Weekend/day-specific patrol during predicted peak window",
}

VALID_TYPES = {"STRUCTURAL", "RESPONSIVE", "SEASONAL"}


# ---------------------------------------------------------------------------
# Layer 1: Behavioral classification (pure — ignores review flags)
# ---------------------------------------------------------------------------

def _behavioral_type(row: pd.Series) -> tuple[str, str, str]:
    """
    Return (hotspot_type, primary_behavior_signal, basis_str).
    Does NOT consider needs_manual_review — that is Layer 2.
    """
    active_days     = int(row["active_days"])
    active_weeks    = int(row["active_weeks"])
    rec_rate        = float(row["recurrence_rate_days"])
    weekend_share   = float(row["weekend_share"])
    top_day_share   = float(row["top_day_share"])
    total_viol      = int(row["total_violations"])
    peak_day_type   = str(row.get("peak_day_type") or "")

    # --- STRUCTURAL ---
    rule_a = (active_days >= 30 and active_weeks >= 8)
    rule_b = (rec_rate >= 0.25 and active_weeks >= 6)
    if rule_a or rule_b:
        if rule_a:
            basis = (f"active_days={active_days}, active_weeks={active_weeks} "
                     f"[rule A: >=30 days AND >=8 weeks]")
        else:
            basis = (f"recurrence_rate={rec_rate:.3f}, active_weeks={active_weeks} "
                     f"[rule B: rate>=0.25 AND >=6 weeks]")
        return "STRUCTURAL", "recurrent_across_weeks", basis

    # --- SEASONAL ---
    if weekend_share >= 0.45:
        basis = f"weekend_share={weekend_share:.3f} (>=0.45)"
        return "SEASONAL", "weekend_dominant", basis
    if peak_day_type == "WEEKEND":
        basis = "peak_day_type=WEEKEND (from M3)"
        return "SEASONAL", "weekend_dominant", basis

    # --- RESPONSIVE (default) ---
    if top_day_share >= 0.35:
        basis = f"top_day_share={top_day_share:.3f} (>=0.35, single-day burst)"
        signal = "burst_or_short_term"
    elif active_days < 14 and total_viol >= 50:
        basis = f"active_days={active_days} (<14) AND total_violations={total_viol} (>=50)"
        signal = "burst_or_short_term"
    elif total_viol < 30 or active_days < 7:
        basis = (f"sparse/low-signal cluster; active_days={active_days}, "
                 f"violations={total_viol} — treat as responsive until more data")
        signal = "sparse_low_signal"
    else:
        basis = (f"default responsive; active_days={active_days}, "
                 f"violations={total_viol}, rec_rate={rec_rate:.3f}")
        signal = "burst_or_short_term"
    return "RESPONSIVE", signal, basis


# ---------------------------------------------------------------------------
# Layer 2: Deployment readiness (review flag)
# ---------------------------------------------------------------------------

def _readiness_layer(row: pd.Series) -> tuple[int, str, str]:
    """
    Return (needs_review_flag, deployment_readiness, review_reason).
    Completely separate from behavioral classification.
    """
    nmr     = int(row["needs_manual_review"])
    quality = str(row["cluster_quality"])

    if quality == "needs_review":
        return 1, "REVIEW_FIRST", "Cluster quality marked needs_review; verify exact hotspot boundary"
    if nmr == 1:
        viol = int(row["total_violations"])
        if viol >= 5000:
            return 1, "REVIEW_FIRST", "Large/high-density cluster; inspect before operational use"
        return 1, "REVIEW_FIRST", "Phase 2 manual review flag; verify geography before deployment"
    return 0, "READY", "No review required"


# ---------------------------------------------------------------------------
# Confidence / signal strength
# ---------------------------------------------------------------------------

def _confidence(total_violations: int, active_days: int,
                recurrence_rate: float, top_day_share: float) -> str:
    if (total_violations >= 100 and active_days >= 14 and
            (recurrence_rate >= 0.15 or top_day_share >= 0.25)):
        return "HIGH"
    if total_violations >= 30 or active_days >= 7:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def _notes(row: pd.Series) -> str:
    parts = []
    if row["total_violations"] < 30:
        parts.append("sparse violations (<30)")
    if row["active_days"] < 7:
        parts.append("very few active days (<7)")
    if row["observation_span_days"] <= 7:
        parts.append("very short observation span (<=7 days)")
    if row["deployment_readiness"] == "REVIEW_FIRST":
        parts.append(f"deployment gated: {row['review_reason']}")
    return "; ".join(parts) if parts else "clean"


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def compute_classification(
    handoff_path: Path = HANDOFF_PATH,
    summary_path: Path = SUMMARY_PATH,
    peak_windows_path: Path = PEAK_WINDOWS_PATH,
    jurisdiction_path: Path = JURISDICTION_PATH,
) -> pd.DataFrame:
    """Return one-row-per-cluster DataFrame with M4 classification."""

    # ------------------------------------------------------------------
    # 1. Load and filter row-level handoff
    # ------------------------------------------------------------------
    df_raw = pd.read_parquet(handoff_path)
    df = df_raw[(df_raw["is_clustered"] == 1) &
                (df_raw["cluster_id"] != "NOISE")].copy()

    summary = pd.read_parquet(summary_path)

    # ------------------------------------------------------------------
    # 2. Per-cluster temporal features from row-level data
    # ------------------------------------------------------------------

    # Daily violation counts → max_daily_violations
    daily = (df.groupby(["cluster_id", "date_ist"])
               .size()
               .reset_index(name="daily_count"))
    daily_agg = daily.groupby("cluster_id").agg(
        max_daily_violations=("daily_count", "max"),
    )

    # Observation span (first to last date per cluster)
    date_range = df.groupby("cluster_id")["date_ist"].agg(["min", "max"])
    date_range["observation_span_days"] = (
        (pd.to_datetime(date_range["max"]) - pd.to_datetime(date_range["min"])).dt.days + 1
    )

    # Weekend / weekday share
    we_viol     = df.groupby("cluster_id")["is_weekend"].sum().rename("we_violations")
    total_count = df.groupby("cluster_id").size().rename("row_count")
    shares = pd.concat([we_viol, total_count], axis=1)
    shares["weekend_share"] = (shares["we_violations"] / shares["row_count"]).round(4)
    shares["weekday_share"] = (1 - shares["weekend_share"]).round(4)

    # ------------------------------------------------------------------
    # 3. Build cluster-level base frame
    # ------------------------------------------------------------------
    base = summary[["cluster_id", "violation_count", "active_days", "active_weeks",
                     "cluster_quality", "needs_manual_review"]].copy()
    base = base.rename(columns={"violation_count": "total_violations"})

    base = base.merge(daily_agg,                          on="cluster_id", how="left")
    base = base.merge(date_range[["observation_span_days"]], on="cluster_id", how="left")
    base = base.merge(shares[["weekend_share", "weekday_share"]], on="cluster_id", how="left")

    # Derived features
    base["recurrence_rate_days"] = (
        base["active_days"] / base["observation_span_days"]
    ).round(4)
    base["week_coverage_rate"] = (
        base["active_weeks"] / base["active_weeks"].max()   # normalised (max=23 weeks)
    ).round(4)
    base["avg_violations_per_active_day"] = (
        base["total_violations"] / base["active_days"].clip(lower=1)
    ).round(2)
    base["top_day_share"] = (
        base["max_daily_violations"] / base["total_violations"].clip(lower=1)
    ).round(4)

    # ------------------------------------------------------------------
    # 4. Join M3 peak-window columns (optional)
    # ------------------------------------------------------------------
    pw_cols = ["cluster_id", "peak_hour", "peak_hour_share",
               "temporal_concentration_score", "peak_day_type"]
    if peak_windows_path.exists():
        pw = pd.read_parquet(peak_windows_path)[pw_cols]
        base = base.merge(pw, on="cluster_id", how="left")
    else:
        for col in pw_cols[1:]:
            base[col] = None

    # ------------------------------------------------------------------
    # 5. Join M18 jurisdiction columns (optional)
    # ------------------------------------------------------------------
    jc_cols = ["cluster_id", "assigned_station", "station_priority_band"]
    if jurisdiction_path.exists():
        jc = pd.read_parquet(jurisdiction_path)[jc_cols]
        base = base.merge(jc, on="cluster_id", how="left")
    else:
        base["assigned_station"]    = None
        base["station_priority_band"] = None

    # ------------------------------------------------------------------
    # 6. Layer 1 — behavioral classification
    # ------------------------------------------------------------------
    behav = base.apply(
        lambda row: pd.Series(
            _behavioral_type(row),
            index=["hotspot_type", "primary_behavior_signal", "_basis"],
        ),
        axis=1,
    )
    base["hotspot_type"]             = behav["hotspot_type"]
    base["primary_behavior_signal"]  = behav["primary_behavior_signal"]
    base["_basis"]                   = behav["_basis"]

    # ------------------------------------------------------------------
    # 7. Layer 2 — deployment readiness (independent of behavioral type)
    # ------------------------------------------------------------------
    readiness = base.apply(
        lambda row: pd.Series(
            _readiness_layer(row),
            index=["needs_review_flag", "deployment_readiness", "review_reason"],
        ),
        axis=1,
    )
    base["needs_review_flag"]   = readiness["needs_review_flag"].astype(int)
    base["deployment_readiness"] = readiness["deployment_readiness"]
    base["review_reason"]        = readiness["review_reason"]

    # ------------------------------------------------------------------
    # 8. Recommended action = readiness + behavior
    # ------------------------------------------------------------------
    def _action(row: pd.Series) -> str:
        base_act = BASE_ACTION[row["hotspot_type"]]
        if row["deployment_readiness"] == "REVIEW_FIRST":
            return f"Review geography first; if confirmed, apply: {base_act}"
        return base_act

    base["recommended_action"] = base.apply(_action, axis=1)

    # ------------------------------------------------------------------
    # 9. Confidence and signal strength (same rule, named separately)
    # ------------------------------------------------------------------
    base["classification_confidence"] = base.apply(
        lambda row: _confidence(
            int(row["total_violations"]),
            int(row["active_days"]),
            float(row["recurrence_rate_days"]),
            float(row["top_day_share"]),
        ),
        axis=1,
    )
    # behavior_signal_strength mirrors classification_confidence but named
    # to make it clear it describes the behavioral signal, not the review gate
    base["behavior_signal_strength"] = base["classification_confidence"]

    # ------------------------------------------------------------------
    # 10. m4_reason and m4_notes
    # ------------------------------------------------------------------
    base["m4_reason"] = base["_basis"]
    base["m4_notes"]  = base.apply(_notes, axis=1)

    # ------------------------------------------------------------------
    # 11. Select and order output columns
    # ------------------------------------------------------------------
    out_cols = [
        "cluster_id", "total_violations", "active_days", "active_weeks",
        "observation_span_days", "recurrence_rate_days", "week_coverage_rate",
        "avg_violations_per_active_day", "max_daily_violations", "top_day_share",
        "weekend_share", "weekday_share",
        "peak_hour", "peak_hour_share", "temporal_concentration_score",
        "assigned_station", "station_priority_band",
        "cluster_quality", "needs_manual_review",
        "hotspot_type",
        "needs_review_flag", "deployment_readiness", "review_reason",
        "primary_behavior_signal", "behavior_signal_strength",
        "recommended_action", "classification_confidence",
        "m4_reason", "m4_notes",
    ]
    result = base[[c for c in out_cols if c in base.columns]].copy()
    return result


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

def run(
    handoff_path: Path = HANDOFF_PATH,
    summary_path: Path = SUMMARY_PATH,
    peak_windows_path: Path = PEAK_WINDOWS_PATH,
    jurisdiction_path: Path = JURISDICTION_PATH,
    out_parquet: Path = OUT_PARQUET,
    out_csv: Path = OUT_CSV,
) -> pd.DataFrame:
    result = compute_classification(
        handoff_path, summary_path, peak_windows_path, jurisdiction_path
    )
    result.to_parquet(out_parquet, index=False)
    result.to_csv(out_csv, index=False)
    return result


if __name__ == "__main__":
    df = run()
    print(f"M4 complete. {len(df)} clusters.")
    print(df["hotspot_type"].value_counts().to_string())
    print(df["deployment_readiness"].value_counts().to_string())
