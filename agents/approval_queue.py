"""
Approval queue for the daily master plan.

The head officer (ACP/JCT) receives the plan, reviews it, and either approves
or revises it.  Only approved plans are dispatched to individual officers.

Idempotency: the previous pending plan is archived to
    pending_master_plan_<run_id>.json
before being overwritten, so no pending plan is ever lost.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

PROJECT_ROOT  = Path(__file__).resolve().parent.parent
PENDING_PLAN  = PROJECT_ROOT / "data" / "outputs" / "pending_master_plan.json"
APPROVED_PLAN = PROJECT_ROOT / "data" / "outputs" / "approved_master_plan.json"
ARCHIVE_DIR   = PROJECT_ROOT / "data" / "outputs" / "plan_archive"

_IST = timezone(timedelta(hours=5, minutes=30))


def _ensure_dirs() -> None:
    PENDING_PLAN.parent.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)


def _archive_pending() -> Optional[str]:
    """
    If a pending plan already exists, copy it to ARCHIVE_DIR before it is overwritten.

    Returns the archive path string, or None if no existing pending plan was found.
    """
    if not PENDING_PLAN.exists():
        return None
    existing = json.loads(PENDING_PLAN.read_text(encoding="utf-8"))
    prev_run_id = existing.get("run_id") or existing.get("submitted_at", "unknown").replace(":", "-")
    archive_name = f"pending_master_plan_{prev_run_id}.json"
    dest = ARCHIVE_DIR / archive_name
    shutil.copy2(PENDING_PLAN, dest)
    return str(dest)


def submit_plan_for_approval(plan: dict) -> dict:
    """
    Save a generated plan as pending approval.

    Archives the previous pending plan (if any) before overwriting.
    Injects run_id and generated_at_ist into the plan if not already present.
    """
    _ensure_dirs()

    # Archive the old pending plan so it's not silently lost
    archive_path = _archive_pending()
    if archive_path:
        print(f"[QUEUE] Previous pending plan archived → {archive_path}")

    plan["status"]       = "pending"
    plan["submitted_at"] = datetime.now(timezone.utc).isoformat()
    plan["submitted_at_ist"] = datetime.now(_IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")

    if not plan.get("run_id"):
        plan["run_id"] = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    PENDING_PLAN.write_text(json.dumps(plan, indent=2, default=str), encoding="utf-8")
    return {
        "status":       "pending",
        "run_id":       plan["run_id"],
        "path":         str(PENDING_PLAN),
        "archive_path": archive_path,
    }


def get_pending_plan() -> Optional[dict]:
    """Return the current pending plan, if any."""
    if PENDING_PLAN.exists():
        return json.loads(PENDING_PLAN.read_text(encoding="utf-8"))
    return None


def get_approved_plan() -> Optional[dict]:
    """Return the last approved plan, if any."""
    if APPROVED_PLAN.exists():
        return json.loads(APPROVED_PLAN.read_text(encoding="utf-8"))
    return None


def approve_plan() -> dict:
    """Approve the pending plan and copy it to the approved path."""
    if not PENDING_PLAN.exists():
        return {"status": "error", "message": "No pending plan to approve"}

    plan = json.loads(PENDING_PLAN.read_text(encoding="utf-8"))
    plan["status"]      = "approved"
    plan["approved_at"] = datetime.now(timezone.utc).isoformat()
    plan["approved_at_ist"] = datetime.now(_IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")

    APPROVED_PLAN.parent.mkdir(parents=True, exist_ok=True)
    APPROVED_PLAN.write_text(json.dumps(plan, indent=2, default=str), encoding="utf-8")
    return {
        "status":  "approved",
        "run_id":  plan.get("run_id"),
        "path":    str(APPROVED_PLAN),
    }


def revise_plan(revised_plan: dict) -> dict:
    """Replace the pending plan with a revised version (archives the old one first)."""
    _ensure_dirs()
    archive_path = _archive_pending()
    if archive_path:
        print(f"[QUEUE] Pending plan archived before revision → {archive_path}")

    revised_plan["status"]     = "revised"
    revised_plan["revised_at"] = datetime.now(timezone.utc).isoformat()
    PENDING_PLAN.write_text(json.dumps(revised_plan, indent=2, default=str), encoding="utf-8")
    return {"status": "revised", "path": str(PENDING_PLAN), "archive_path": archive_path}


def simulate_head_approval() -> dict:
    """For demo use only: auto-approve the pending plan."""
    return approve_plan()
