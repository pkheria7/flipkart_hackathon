"""
Daily scheduler for the parking intelligence agent.

Runs the full pipeline at 4:00 AM, generates the master plan, and submits it
for head-officer approval. Officer dispatch happens only after approval.
"""

from __future__ import annotations

from apscheduler.schedulers.blocking import BlockingScheduler

from agents.pipeline_runner import run_full_pipeline
from agents.plan_generator import generate_master_plan
from agents.approval_queue import submit_plan_for_approval
from agents.state_manager import record_run_start


def daily_job(dry_run: bool = True) -> dict:
    """End-of-day pipeline + plan generation job."""
    run_id = record_run_start()
    print(f"[SCHEDULER] Starting daily run {run_id}")

    # 1. Run full pipeline
    pipeline_result = run_full_pipeline()
    if pipeline_result["status"] != "success":
        print(f"[SCHEDULER] Pipeline failed: {pipeline_result.get('error')}")
        return {"status": "failed", "run_id": run_id, "pipeline": pipeline_result}

    # 2. Generate master plan
    plan = generate_master_plan()
    print(f"[SCHEDULER] Generated master plan with {plan['total_assignments']} assignments")

    # 3. Submit for approval
    approval = submit_plan_for_approval(plan)
    print(f"[SCHEDULER] Plan status: {approval['status']}")

    return {
        "status": "success",
        "run_id": run_id,
        "pipeline_steps": pipeline_result.get("steps", []),
        "total_seconds": pipeline_result.get("total_seconds", 0),
        "plan": {"date": plan["date"], "total_assignments": plan["total_assignments"]},
        "approval": approval,
    }


def start_scheduler(dry_run: bool = True) -> None:
    """Start the blocking scheduler. Runs daily at 4:00 AM."""
    scheduler = BlockingScheduler()
    scheduler.add_job(
        lambda: daily_job(dry_run=dry_run),
        "cron",
        hour=4,
        minute=0,
        id="btp_daily_agent",
    )
    print("[SCHEDULER] Started. Daily job scheduled for 04:00.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("[SCHEDULER] Stopped.")


if __name__ == "__main__":
    import sys
    # Allow `python agents/scheduler.py --now` to run once immediately
    if "--now" in sys.argv:
        result = daily_job(dry_run=True)
        import json
        print(json.dumps(result, indent=2, default=str))
    else:
        start_scheduler(dry_run=True)
