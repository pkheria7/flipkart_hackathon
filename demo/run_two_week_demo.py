"""
Orchestrate the full 2-week synthetic demo.

Steps:
1. Generate synthetic officers and tow trucks.
2. Generate Week 1 synthetic scored hotspots.
3. Generate Week 1 daily master plan.
4. Simulate head-officer approval and dispatch emails.
5. Generate synthetic feedback events.
6. Generate Week 2 synthetic scored hotspots using Week 1 feedback.
7. Generate Week 2 daily master plan.
8. Generate comparison report.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd

from demo.synth_officers import generate_officers
from demo.synth_tow_trucks import generate_tow_trucks
from demo.synth_weekly_scores import generate_week_1, generate_week_2
from demo.synth_feedback import generate_week_1_feedback
from demo.generate_demo_report import main as generate_report

from agents.plan_generator import generate_master_plan
from agents.approval_queue import submit_plan_for_approval, simulate_head_approval
from agents.dispatcher import dispatch_head_officer, dispatch_approved_plan
from agents.state_manager import snapshot_outputs
from demo.synth_weekly_scores import SYNTH_DIR


def _use_scored(path: Path) -> None:
    """Temporarily replace the production scored_hotspots with a synthetic one."""
    prod = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
    shutil.copy2(path, prod)


def _restore_real_scored() -> None:
    """Restore real scored_hotspots by re-running M1."""
    print("\n[Demo] Restoring real scored_hotspots...")
    m1 = _load_module("pipeline_m1_roi", PROJECT_ROOT / "pipeline" / "m1_roi_ranker.py")
    m1.run_m1()


def _load_module(module_name: str, file_path: Path):
    import importlib.util
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_demo() -> dict:
    print("=" * 60)
    print("Running 2-week synthetic demo")
    print("=" * 60)

    # Step 1: rosters
    print("\n[Demo] Generating officer and tow-truck rosters...")
    officers = generate_officers()
    trucks = generate_tow_trucks()

    # Step 2: Week 1 synthetic scored hotspots
    print("\n[Demo] Generating Week 1 synthetic scored hotspots...")
    week_1 = generate_week_1()
    _use_scored(SYNTH_DIR / "week_1_scored_hotspots.parquet")

    # Step 3: Week 1 master plan
    print("\n[Demo] Generating Week 1 master plan...")
    plan_1 = generate_master_plan(date_str="2026-06-15")
    submit_plan_for_approval(plan_1)

    # Step 4: simulate approval + dispatch
    print("\n[Demo] Simulating head-officer approval and dispatch...")
    simulate_head_approval()
    head_1 = dispatch_head_officer(plan_1, dry_run=True)
    disp_1 = dispatch_approved_plan(plan_1, dry_run=True)
    snapshot_outputs("week_1")

    # Step 5: Week 1 feedback
    print("\n[Demo] Generating Week 1 feedback events...")
    feedback = generate_week_1_feedback(week_1, officers)

    # Step 6: Week 2 synthetic scored hotspots
    print("\n[Demo] Generating Week 2 synthetic scored hotspots...")
    week_2 = generate_week_2(week_1, feedback)
    _use_scored(SYNTH_DIR / "week_2_scored_hotspots.parquet")

    # Step 7: Week 2 master plan
    print("\n[Demo] Generating Week 2 master plan...")
    plan_2 = generate_master_plan(date_str="2026-06-22")
    submit_plan_for_approval(plan_2)
    simulate_head_approval()
    head_2 = dispatch_head_officer(plan_2, dry_run=True)
    disp_2 = dispatch_approved_plan(plan_2, dry_run=True)
    snapshot_outputs("week_2")

    # Step 8: comparison report
    print("\n[Demo] Generating comparison report...")
    generate_report()

    # Step 9: restore real scored hotspots
    _restore_real_scored()

    print("\n" + "=" * 60)
    print("2-week demo complete")
    print("=" * 60)

    return {
        "week_1_violations": int(week_1["violation_count"].sum()),
        "week_2_violations": int(week_2["violation_count"].sum()),
        "feedback_events": len(feedback),
        "emails_generated": len(disp_1) + len(disp_2) + (1 if head_1.get("dry_run") else 0) + (1 if head_2.get("dry_run") else 0),
    }


if __name__ == "__main__":
    results = run_demo()
    print("\nSummary:")
    for k, v in results.items():
        print(f"  {k}: {v}")
