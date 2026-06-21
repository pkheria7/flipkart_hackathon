"""
Approval queue for the daily master plan.

The head officer (ACP/JCT) receives the plan, reviews it, and either approves
or revises it. Only approved plans are dispatched to individual officers.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PENDING_PLAN = PROJECT_ROOT / "data" / "outputs" / "pending_master_plan.json"
APPROVED_PLAN = PROJECT_ROOT / "data" / "outputs" / "approved_master_plan.json"


def _ensure_dirs() -> None:
    PENDING_PLAN.parent.mkdir(parents=True, exist_ok=True)


def submit_plan_for_approval(plan: dict) -> dict:
    """Save a generated plan as pending approval."""
    _ensure_dirs()
    plan["status"] = "pending"
    plan["submitted_at"] = datetime.now(timezone.utc).isoformat()
    PENDING_PLAN.write_text(json.dumps(plan, indent=2, default=str), encoding="utf-8")
    return {"status": "pending", "path": str(PENDING_PLAN)}


def get_pending_plan() -> dict | None:
    """Return the current pending plan, if any."""
    if PENDING_PLAN.exists():
        return json.loads(PENDING_PLAN.read_text(encoding="utf-8"))
    return None


def get_approved_plan() -> dict | None:
    """Return the last approved plan, if any."""
    if APPROVED_PLAN.exists():
        return json.loads(APPROVED_PLAN.read_text(encoding="utf-8"))
    return None


def approve_plan() -> dict:
    """Approve the pending plan and copy it to approved path."""
    if not PENDING_PLAN.exists():
        return {"status": "error", "message": "No pending plan to approve"}

    plan = json.loads(PENDING_PLAN.read_text(encoding="utf-8"))
    plan["status"] = "approved"
    plan["approved_at"] = datetime.now(timezone.utc).isoformat()
    APPROVED_PLAN.parent.mkdir(parents=True, exist_ok=True)
    APPROVED_PLAN.write_text(json.dumps(plan, indent=2, default=str), encoding="utf-8")
    return {"status": "approved", "path": str(APPROVED_PLAN)}


def revise_plan(revised_plan: dict) -> dict:
    """Replace the pending plan with a revised version."""
    _ensure_dirs()
    revised_plan["status"] = "revised"
    revised_plan["revised_at"] = datetime.now(timezone.utc).isoformat()
    PENDING_PLAN.write_text(json.dumps(revised_plan, indent=2, default=str), encoding="utf-8")
    return {"status": "revised", "path": str(PENDING_PLAN)}


def simulate_head_approval() -> dict:
    """For demo use only: auto-approve the pending plan."""
    return approve_plan()
