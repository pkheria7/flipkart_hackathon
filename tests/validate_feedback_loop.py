"""
Validation — Feedback-aware scoring loop (M12 + M1 integration)

Owner: Piyush — Core ROI Pipeline spine.

Purpose:
    Verify that the feedback loop closes: a cluster marked as
    "enforced but recurred" in feedback.sqlite is pushed to STRUCTURAL
    with the structural recommended action in scored_hotspots.parquet.

Usage:
    python tests/validate_feedback_loop.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.officer.feedback_backend import get_feedback_summary_for_scoring

SCORED_PATH = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
ENRICHED_PATH = PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet"
REPORT_PATH = PROJECT_ROOT / "reports" / "FEEDBACK_LOOP_VALIDATION_REPORT.md"

STRUCTURAL_ACTION = "Recurring patrol + towing support + signage/infra review"


def main() -> int:
    print("[validate_feedback_loop] Loading feedback summary...")
    feedback = get_feedback_summary_for_scoring()
    boosted_ids = set(feedback[feedback["feedback_structural_boost"] == 1]["cluster_id"])
    print(f"[validate_feedback_loop] Clusters with feedback_structural_boost=1: {len(boosted_ids)}")

    print("[validate_feedback_loop] Loading scored hotspots...")
    scored = pd.read_parquet(SCORED_PATH)

    print("[validate_feedback_loop] Loading enriched clusters...")
    enriched = pd.read_parquet(ENRICHED_PATH)

    checks = []

    # Check 1: every feedback-boosted cluster is STRUCTURAL in final output
    if boosted_ids:
        boosted_scored = scored[scored["cluster_id"].isin(boosted_ids)]
        all_structural = (boosted_scored["classification"] == "STRUCTURAL").all()
        checks.append(("boosted_clusters_are_structural", all_structural,
                       f"{boosted_scored['classification'].value_counts().to_dict()}"))

        # Check 2: every feedback-boosted cluster has the structural action
        all_action_ok = (boosted_scored["recommended_action"] == STRUCTURAL_ACTION).all()
        checks.append(("boosted_clusters_have_structural_action", all_action_ok,
                       f"unique actions: {boosted_scored['recommended_action'].unique().tolist()}"))
    else:
        checks.append(("boosted_clusters_are_structural", True, "no boosted clusters in DB"))
        checks.append(("boosted_clusters_have_structural_action", True, "no boosted clusters in DB"))

    # Check 3: feedback columns exist in enriched_clusters
    has_feedback_col = "feedback_structural_boost" in enriched.columns
    checks.append(("enriched_has_feedback_structural_boost", has_feedback_col, ""))

    # Check 4: at least one boosted cluster had its recommended_action updated by feedback
    # (classification may already be STRUCTURAL from M4; action override still proves the loop)
    action_updated = []
    if boosted_ids:
        pcf = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "prakhar_cluster_features.parquet")
        pcf_idx = pcf.set_index("cluster_id")
        scored_idx = scored.set_index("cluster_id")
        for cid in boosted_ids:
            if cid in pcf_idx.index:
                original_action = pcf_idx.loc[cid, "recommended_action"]
                final_action = scored_idx.loc[cid, "recommended_action"]
                if original_action != final_action:
                    action_updated.append({
                        "cluster_id": cid,
                        "original_action": original_action,
                        "final_action": final_action,
                    })
    checks.append(("boosted_clusters_action_updated_by_feedback", len(action_updated) > 0,
                   f"updated {len(action_updated)} cluster(s): {action_updated}"))

    # Write report
    lines = [
        "# Feedback Loop Validation Report",
        "",
        "This report verifies that the M12 feedback backend correctly influences the final scoring output.",
        "",
        "## Checks",
        "",
        "| check | status | detail |",
        "|-------|--------|--------|",
    ]
    for name, passed, detail in checks:
        status = "PASS" if passed else "FAIL"
        lines.append(f"| {name} | {status} | {detail} |")

    lines.extend([
        "",
        "## Boosted clusters",
        "",
    ])
    if boosted_ids:
        lines.append(f"Clusters with `feedback_structural_boost = 1`: `{sorted(boosted_ids)}`")
        lines.append("")
        lines.append("| cluster_id | original_action | final_action |")
        lines.append("|------------|-----------------|--------------|")
        for item in action_updated:
            cid = item["cluster_id"]
            lines.append(
                f"| {cid} | {item['original_action']} | {item['final_action']} |"
            )
    else:
        lines.append("No clusters currently have `feedback_structural_boost = 1`.")

    lines.extend([
        "",
        "## Verdict",
        "",
        f"**{'PASS' if all(c[1] for c in checks) else 'FAIL'}** — all feedback-loop checks.",
    ])

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"[validate_feedback_loop] Report written: {REPORT_PATH}")

    for name, passed, detail in checks:
        print(f"  {'PASS' if passed else 'FAIL'}: {name} — {detail}")

    return 0 if all(c[1] for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
