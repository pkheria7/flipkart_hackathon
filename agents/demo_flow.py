"""
Safe plan-only demo flow for the Flipkart Gridlock agent layer.

Does NOT re-run the raw-data pipeline (01_clean → 05_score → M1/M7).
Reads existing backend outputs and runs only:

    generate_master_plan()
    → submit_plan_for_approval()
    → approve_plan()
    → dispatch_approved_plan()  (dry-run by default)

All four outputs — daily_master_plan.json, pending_master_plan.json,
approved_master_plan.json, and agent_state.json — share the SAME run_id.
Dry-run emails are written to  data/outputs/eml/<run_id>/.

Usage:
    python agents/demo_flow.py
    python agents/demo_flow.py --use-llm --auto-approve --auto-dispatch
    python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run
    python agents/demo_flow.py --auto-approve --auto-dispatch --no-dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from agents.plan_generator  import generate_master_plan
from agents.approval_queue  import submit_plan_for_approval, approve_plan, get_approved_plan
from agents.dispatcher      import dispatch_approved_plan

_IST = timezone(timedelta(hours=5, minutes=30))


def run_demo_flow(
    use_llm:       bool = False,
    auto_approve:  bool = True,
    auto_dispatch: bool = True,
    dry_run:       bool = True,
    run_id:        str | None = None,
) -> dict:
    """
    Execute the full plan → approve → dispatch flow without touching the pipeline.

    Parameters
    ----------
    use_llm:       Call Groq LLaMA for plain-English explanations (needs GROQ_API_KEY).
    auto_approve:  Auto-approve the pending plan.
    auto_dispatch: Auto-dispatch after approval (only works when auto_approve=True).
    dry_run:       Write .eml files instead of sending via SMTP.
    run_id:        Override the auto-generated timestamp run_id.

    Returns a summary dict with all output paths and counts.
    """
    if run_id is None:
        run_id = datetime.now(_IST).strftime("%Y%m%d_%H%M%S")

    print(f"[DEMO] run_id: {run_id}")
    print(f"[DEMO] use_llm={use_llm}, auto_approve={auto_approve}, "
          f"auto_dispatch={auto_dispatch}, dry_run={dry_run}")

    # ---- 1. Generate master plan ----
    plan = generate_master_plan(
        run_id=run_id,
        use_llm=use_llm,
        llm_top_n=3,
        allow_unassigned=True,
    )
    print(f"[DEMO] Plan generated: {plan['total_assignments']} assignments, "
          f"{len(plan['stations'])} stations, "
          f"routing={plan.get('routing_source')}, "
          f"m10_routing_mode={plan.get('m10_routing_mode')}, "
          f"m15_wired={plan.get('m15_wired')}")

    # ---- 2. Submit for approval ----
    approval_result = submit_plan_for_approval(plan)
    print(f"[DEMO] Submitted for approval — run_id in pending plan: "
          f"{json.loads(Path(approval_result['path']).read_text(encoding='utf-8')).get('run_id')}")

    result: dict = {
        "run_id":            run_id,
        "total_assignments": plan["total_assignments"],
        "stations":          len(plan["stations"]),
        "routing_source":    plan.get("routing_source"),
        "m10_routing_mode":  plan.get("m10_routing_mode"),
        "m10_wired":         plan.get("m10_wired"),
        "m15_wired":         plan.get("m15_wired"),
        "daily_master_plan": str(PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json"),
        "pending_plan":      approval_result["path"],
        "approved_plan":     None,
        "emails_sent":       0,
        "eml_dir":           None,
        "auto_approved":     False,
        "dispatched":        False,
    }

    if not auto_approve:
        print("[DEMO] auto_approve=False — stopping before approval.")
        return result

    # ---- 3. Approve ----
    approve_result = approve_plan()
    print(f"[DEMO] Approved — status: {approve_result['status']}, "
          f"run_id: {approve_result.get('run_id')}")
    result["approved_plan"] = approve_result["path"]
    result["auto_approved"] = True

    if not auto_dispatch:
        print("[DEMO] auto_dispatch=False — stopping before dispatch.")
        return result

    # ---- 4. Dispatch ----
    approved = get_approved_plan()
    if not approved:
        print("[DEMO] ERROR: approved plan not found after approve_plan().")
        return result

    dispatch_results = dispatch_approved_plan(approved, dry_run=dry_run)
    eml_dir = PROJECT_ROOT / "data" / "outputs" / "eml" / run_id
    print(f"[DEMO] Dispatch complete — {len(dispatch_results)} emails "
          f"({'dry-run' if dry_run else 'real'}) → {eml_dir}")

    result["emails_sent"] = len(dispatch_results)
    result["eml_dir"]     = str(eml_dir)
    result["dispatched"]  = True

    return result


def _verify_consistency(run_id: str) -> list[str]:
    """Return a list of consistency issues (empty list = all OK)."""
    issues: list[str] = []

    files = {
        "daily_master_plan":    PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json",
        "pending_master_plan":  PROJECT_ROOT / "data" / "outputs" / "pending_master_plan.json",
        "approved_master_plan": PROJECT_ROOT / "data" / "outputs" / "approved_master_plan.json",
        "agent_state":          PROJECT_ROOT / "data" / "outputs" / "agent_state.json",
    }

    for name, path in files.items():
        if not path.exists():
            issues.append(f"{name}: FILE MISSING")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if name == "agent_state":
            actual = data.get("last_run_id")
        else:
            actual = data.get("run_id")
        if actual != run_id:
            issues.append(f"{name}: run_id mismatch — expected {run_id!r}, got {actual!r}")

    eml_dir = PROJECT_ROOT / "data" / "outputs" / "eml" / run_id
    if not eml_dir.exists():
        issues.append(f"eml/{run_id}/: directory missing")

    return issues


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Safe plan-only demo flow")
    parser.add_argument("--use-llm",       action="store_true", default=False,
                        help="Enable Groq LLM explanations (needs GROQ_API_KEY)")
    parser.add_argument("--auto-approve",  action="store_true", default=False,
                        help="Automatically approve the pending plan")
    parser.add_argument("--auto-dispatch", action="store_true", default=False,
                        help="Automatically dispatch after approval")
    parser.add_argument("--dry-run",       action="store_true", default=True,
                        help="Write .eml files instead of real SMTP (default: True)")
    parser.add_argument("--no-dry-run",    action="store_true", default=False,
                        help="Send real emails via SMTP (requires SMTP_USER, SMTP_PASS)")
    parser.add_argument("--run-id",        type=str, default=None,
                        help="Override auto-generated run_id (default: YYYYMMDD_HHMMSS IST)")
    args = parser.parse_args()

    dry_run = not args.no_dry_run

    result = run_demo_flow(
        use_llm=args.use_llm,
        auto_approve=args.auto_approve,
        auto_dispatch=args.auto_dispatch,
        dry_run=dry_run,
        run_id=args.run_id,
    )

    print()
    print("=" * 60)
    print("DEMO FLOW RESULT")
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))

    # Consistency check
    if result.get("auto_approved"):
        issues = _verify_consistency(result["run_id"])
        print()
        if issues:
            print("CONSISTENCY ISSUES:")
            for i in issues:
                print(f"  ✗ {i}")
            sys.exit(1)
        else:
            print("run_id CONSISTENCY: all outputs agree on run_id =", result["run_id"])
            sys.exit(0)
    else:
        sys.exit(0)
