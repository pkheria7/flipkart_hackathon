"""
Generate the Week 1 vs Week 2 demo comparison report.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SYNTH_DIR = PROJECT_ROOT / "data" / "outputs" / "synthetic_demo"
REPORT_PATH = PROJECT_ROOT / "reports" / "WEEK_1_VS_WEEK_2_DEMO_REPORT.md"


def build_report() -> str:
    w1 = pd.read_parquet(SYNTH_DIR / "week_1_scored_hotspots.parquet")
    w2 = pd.read_parquet(SYNTH_DIR / "week_2_scored_hotspots.parquet")

    total_violations_w1 = int(w1["violation_count"].sum())
    total_violations_w2 = int(w2["violation_count"].sum())
    violation_change = total_violations_w2 - total_violations_w1
    violation_change_pct = (violation_change / total_violations_w1) * 100 if total_violations_w1 else 0

    structural_w1 = int((w1["classification"] == "STRUCTURAL").sum())
    structural_w2 = int((w2["classification"] == "STRUCTURAL").sum())

    responsive_w1 = int((w1["classification"] == "RESPONSIVE").sum())
    responsive_w2 = int((w2["classification"] == "RESPONSIVE").sum())

    avg_roi_w1 = float(w1["roi_score"].mean())
    avg_roi_w2 = float(w2["roi_score"].mean())

    # Counterfactual: what if no enforcement happened?
    # Simple model: Week 2 would be Week 1 + 5% growth
    counterfactual_violations = int(total_violations_w1 * 1.05)
    prevented_violations = counterfactual_violations - total_violations_w2

    lines = [
        "# Week 1 vs Week 2 Demo Report",
        "",
        "> This report compares two simulated weeks. Week 1 shows the agent's initial proactive patrols and feedback collection. Week 2 shows the simulated outcome after applying enforcement learnings.",
        "",
        "## Key metrics",
        "",
        "| Metric | Week 1 | Week 2 | Change |",
        "|--------|--------|--------|--------|",
        f"| Total violations | {total_violations_w1:,} | {total_violations_w2:,} | {violation_change:+,} ({violation_change_pct:+.1f}%) |",
        f"| STRUCTURAL clusters | {structural_w1} | {structural_w2} | {structural_w2 - structural_w1:+,} |",
        f"| RESPONSIVE clusters | {responsive_w1} | {responsive_w2} | {responsive_w2 - responsive_w1:+,} |",
        f"| Avg ROI of hotspots | {avg_roi_w1:.2f} | {avg_roi_w2:.2f} | {avg_roi_w2 - avg_roi_w1:+.2f} |",
        f"| Counterfactual violations (no intervention) | — | {counterfactual_violations:,} | — |",
        f"| Prevented violations (simulated) | — | {prevented_violations:,} | — |",
        "",
        "## Interpretation",
        "",
        "- Week 1 establishes the baseline and generates officer/citizen feedback.",
        "- Recurred hotspots are escalated to STRUCTURAL in Week 2.",
        "- Resolved hotspots show reduced violation counts in Week 2.",
        "- The counterfactual line estimates what Week 2 might have looked like without the agent's intervention.",
        "",
        "## Limitations",
        "",
        "- This is a synthetic simulation based on historical patterns.",
        "- It does not prove real-world causal impact.",
        "- Live deployment requires a real data feed from BTP.",
        "",
        "## Generated outputs",
        "",
        f"- Week 1 synthetic scored hotspots: `{SYNTH_DIR / 'week_1_scored_hotspots.parquet'}`",
        f"- Week 2 synthetic scored hotspots: `{SYNTH_DIR / 'week_2_scored_hotspots.parquet'}`",
    ]

    return "\n".join(lines)


def main() -> None:
    report = build_report()
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"[demo] Generated comparison report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
