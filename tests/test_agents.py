"""
Tests for the agentic layer and synthetic 2-week demo.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd

from agents.plan_generator import generate_master_plan
from agents.approval_queue import submit_plan_for_approval, approve_plan, get_pending_plan
from agents.dispatcher import dispatch_head_officer, dispatch_approved_plan
from agents.mailer import EML_DIR
from agents.feedback_ingestor import ingest_officer_feedback, clear_synthetic_feedback
from agents.state_manager import load_state

from demo.synth_officers import generate_officers
from demo.synth_tow_trucks import generate_tow_trucks
from demo.synth_weekly_scores import generate_week_1, generate_week_2, SYNTH_DIR
from demo.synth_feedback import generate_week_1_feedback


def test_roster_generation():
    officers = generate_officers()
    trucks = generate_tow_trucks()
    assert not officers.empty
    assert not trucks.empty
    assert "officer_id" in officers.columns
    assert "truck_id" in trucks.columns


def test_master_plan_generation():
    plan = generate_master_plan(date_str="2026-06-23")
    assert plan["date"] == "2026-06-23"
    assert plan["total_assignments"] > 0
    assert len(plan["stations"]) > 0
    assert Path(PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json").exists()


def test_approval_workflow():
    plan = generate_master_plan(date_str="2026-06-23")
    submit_plan_for_approval(plan)
    pending = get_pending_plan()
    assert pending is not None
    assert pending["status"] == "pending"

    result = approve_plan()
    assert result["status"] == "approved"


def test_dispatch_creates_eml():
    plan = generate_master_plan(date_str="2026-06-23")
    approve_plan()

    # Clear previous EMLs
    for f in EML_DIR.glob("*.eml"):
        f.unlink()

    head = dispatch_head_officer(plan, dry_run=True)
    assert head["dry_run"] is True
    assert Path(head["eml_path"]).exists()

    dispatched = dispatch_approved_plan(plan, dry_run=True)
    assert len(dispatched) > 0
    eml_files = list(EML_DIR.glob("*.eml"))
    assert len(eml_files) > 1


def test_feedback_ingestion():
    clear_synthetic_feedback()
    result = ingest_officer_feedback(
        cluster_id="C_0_0",
        officer_id="OFF_TEST_01",
        action="towed",
        outcome="recurred",
        reason_code="no_parking_space",
        assigned_station="TEST_STATION",
        source="synthetic_demo",
    )
    assert result["cluster_id"] == "C_0_0"
    assert result["source"] == "synthetic_demo"
    clear_synthetic_feedback()


def test_synthetic_two_week_demo():
    clear_synthetic_feedback()

    officers = generate_officers()
    trucks = generate_tow_trucks()

    week_1 = generate_week_1()
    assert "week" in week_1.columns
    assert week_1["week"].iloc[0] == 1
    assert (SYNTH_DIR / "week_1_scored_hotspots.parquet").exists()

    feedback = generate_week_1_feedback(week_1, officers)
    assert not feedback.empty

    week_2 = generate_week_2(week_1, feedback)
    assert week_2["week"].iloc[0] == 2
    assert (SYNTH_DIR / "week_2_scored_hotspots.parquet").exists()

    # Week 2 should have fewer total violations than Week 1 (because some resolved)
    assert week_2["violation_count"].sum() <= week_1["violation_count"].sum()

    clear_synthetic_feedback()


def test_agent_state_updated():
    state = load_state()
    assert "total_runs" in state


if __name__ == "__main__":
    test_roster_generation()
    print("PASS: test_roster_generation")

    test_master_plan_generation()
    print("PASS: test_master_plan_generation")

    test_approval_workflow()
    print("PASS: test_approval_workflow")

    test_dispatch_creates_eml()
    print("PASS: test_dispatch_creates_eml")

    test_feedback_ingestion()
    print("PASS: test_feedback_ingestion")

    test_synthetic_two_week_demo()
    print("PASS: test_synthetic_two_week_demo")

    test_agent_state_updated()
    print("PASS: test_agent_state_updated")

    print("\nAll agent tests passed.")
