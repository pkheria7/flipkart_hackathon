"""
Daily scheduler for the parking intelligence agent.

Runs the full pipeline at 4:00 AM IST, generates the master plan, and submits
it for head-officer approval.  Officer dispatch happens only after approval.

Usage:
    python agents/scheduler.py               # start cron (04:00 daily)
    python agents/scheduler.py --now         # run once immediately (dry-run)
    python agents/scheduler.py --now --auto-approve --auto-dispatch
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Safe APScheduler import — package is optional for demo/testing
try:
    from apscheduler.schedulers.blocking import BlockingScheduler
    _APSCHEDULER_AVAILABLE = True
except ImportError:
    BlockingScheduler = None  # type: ignore[assignment,misc]
    _APSCHEDULER_AVAILABLE = False

from agents.pipeline_runner  import run_full_pipeline
from agents.plan_generator   import generate_master_plan
from agents.approval_queue   import submit_plan_for_approval, approve_plan
from agents.dispatcher       import dispatch_approved_plan
from agents.state_manager    import record_run_start, snapshot_pre_pipeline, snapshot_outputs


def daily_job(
    dry_run:       bool = True,
    auto_approve:  bool = False,
    auto_dispatch: bool = False,
) -> dict:
    """
    End-of-day pipeline + plan generation job.

    Parameters
    ----------
    dry_run:       Write .eml files instead of sending real emails.
    auto_approve:  Automatically approve the pending plan (for demo/testing).
    auto_dispatch: Automatically dispatch after approval (for demo/testing).
                   Requires auto_approve=True.
    """
    run_id = record_run_start()
    print(f"[SCHEDULER] Starting daily run {run_id} "
          f"(dry_run={dry_run}, auto_approve={auto_approve}, auto_dispatch={auto_dispatch})")

    # 0. Snapshot current outputs BEFORE overwriting them
    snapshot_pre_pipeline(run_id)

    # 1. Run full pipeline
    pipeline_result = run_full_pipeline(run_id=run_id)
    if pipeline_result["status"] != "success":
        print(f"[SCHEDULER] Pipeline failed: {pipeline_result.get('error')}")
        return {"status": "failed", "run_id": run_id, "pipeline": pipeline_result}

    # 2. Generate master plan
    plan = generate_master_plan(run_id=run_id, use_llm=False, allow_unassigned=True)
    print(f"[SCHEDULER] Generated master plan — {plan['total_assignments']} assignments, "
          f"M10={'yes' if plan.get('m10_wired') else 'no'}, "
          f"M15={'yes' if plan.get('m15_wired') else 'no'}")

    # 3. Submit for approval
    approval = submit_plan_for_approval(plan)
    print(f"[SCHEDULER] Plan status: {approval['status']}")

    # 4. Snapshot post-run outputs (plan now exists)
    snapshot_outputs(run_id)

    dispatch_results: list = []

    # 5. Optional: auto-approve (demo mode)
    if auto_approve:
        approve_result = approve_plan()
        print(f"[SCHEDULER] Auto-approved: {approve_result['status']}")

        # 6. Optional: auto-dispatch
        if auto_dispatch:
            from agents.approval_queue import get_approved_plan
            approved = get_approved_plan()
            if approved:
                dispatch_results = dispatch_approved_plan(approved, dry_run=dry_run)
                print(f"[SCHEDULER] Dispatched {len(dispatch_results)} emails (dry_run={dry_run}).")
            else:
                print("[SCHEDULER] No approved plan found for dispatch.")

    return {
        "status":        "success",
        "run_id":        run_id,
        "pipeline_steps": pipeline_result.get("steps", []),
        "total_seconds": pipeline_result.get("total_seconds", 0),
        "plan": {
            "date":              plan["date"],
            "total_assignments": plan["total_assignments"],
            "m10_wired":         plan.get("m10_wired", False),
            "m15_wired":         plan.get("m15_wired", False),
        },
        "approval":        approval,
        "auto_approved":   auto_approve,
        "dispatch_results": dispatch_results,
    }


def start_scheduler(dry_run: bool = True) -> None:
    """Start the blocking APScheduler cron job. Runs daily at 04:00 IST."""
    if not _APSCHEDULER_AVAILABLE:
        print(
            "[SCHEDULER] ERROR — apscheduler is not installed.\n"
            "Install it with:  pip install apscheduler>=3.10.0\n"
            "Then restart this script."
        )
        sys.exit(1)

    scheduler = BlockingScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        lambda: daily_job(dry_run=dry_run),
        "cron",
        hour=4,
        minute=0,
        id="btp_daily_agent",
    )
    print("[SCHEDULER] APScheduler started. Daily job scheduled for 04:00 IST.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("[SCHEDULER] Stopped.")


if __name__ == "__main__":
    args = sys.argv[1:]
    run_now      = "--now"           in args
    plan_only    = "--plan-only"     in args   # skip pipeline, just generate plan
    dry_run      = "--dry-run"       in args or "--now" in args or "--plan-only" in args
    auto_approve = "--auto-approve"  in args
    auto_dispatch= "--auto-dispatch" in args

    # real-send only when --no-dry-run is explicitly passed
    if "--no-dry-run" in args:
        dry_run = False

    if plan_only:
        # Safe plan-only mode — delegates to demo_flow.py logic
        from agents.demo_flow import run_demo_flow
        result = run_demo_flow(
            use_llm=False,
            auto_approve=auto_approve,
            auto_dispatch=auto_dispatch,
            dry_run=dry_run,
        )
        print(json.dumps(result, indent=2, default=str))
    elif run_now:
        result = daily_job(dry_run=dry_run, auto_approve=auto_approve, auto_dispatch=auto_dispatch)
        print(json.dumps(result, indent=2, default=str))
    else:
        start_scheduler(dry_run=dry_run)
