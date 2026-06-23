"""
Deployment-safe bootstrap for agent workflow artifacts.

On fresh clone / Render cold start, gitignored files are absent:
  daily_master_plan.json, pending_master_plan.json, agent_state.json, eml/

This module restores a deterministic demo workflow from committed plan_archive
or by generating a plan from patrol_routes.json + scored_hotspots.

Does NOT overwrite existing files. Does NOT auto-approve or auto-dispatch
(preserves human-in-loop approval → dispatch flow).
"""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUTS = PROJECT_ROOT / "data" / "outputs"
ARCHIVE_DIR = OUTPUTS / "plan_archive"
DAILY_PLAN = OUTPUTS / "daily_master_plan.json"
PENDING_PLAN = OUTPUTS / "pending_master_plan.json"
APPROVED_PLAN = OUTPUTS / "approved_master_plan.json"
AGENT_STATE = OUTPUTS / "agent_state.json"
EML_ROOT = OUTPUTS / "eml"
PATROL_ROUTES = OUTPUTS / "patrol_routes.json"

# Committed demo plans (prefer DEMO_RUN, then newest archive)
_ARCHIVE_CANDIDATES = [
    ARCHIVE_DIR / "pending_master_plan_DEMO_RUN.json",
    ARCHIVE_DIR / "pending_master_plan_20260621_201243.json",
    ARCHIVE_DIR / "pending_master_plan_20260621_152812.json",
]


def _read_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to read %s: %s", path, exc)
        return None


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _load_archived_plan() -> Optional[dict]:
    for candidate in _ARCHIVE_CANDIDATES:
        plan = _read_json(candidate)
        if plan and plan.get("stations"):
            logger.info("Bootstrap: loaded archived plan from %s", candidate.name)
            return plan
    return None


def _generate_fresh_plan(run_id: str = "DEPLOY_BOOTSTRAP") -> dict:
    """Generate plan from deployed pipeline outputs (patrol_routes + hotspots)."""
    from agents.plan_generator import generate_master_plan

    logger.info("Bootstrap: generating fresh master plan (run_id=%s)", run_id)
    return generate_master_plan(run_id=run_id, allow_unassigned=True, use_llm=False)


def _resolve_plan_source() -> dict:
    archived = _load_archived_plan()
    if archived is not None:
        return deepcopy(archived)
    if not PATROL_ROUTES.exists():
        raise FileNotFoundError(
            f"Cannot bootstrap agent workflow: {PATROL_ROUTES} missing"
        )
    return _generate_fresh_plan()


def _sync_agent_state(plan: dict, plan_status: str = "pending") -> None:
    if AGENT_STATE.exists():
        return
    run_id = plan.get("run_id") or "DEPLOY_BOOTSTRAP"
    state = {
        "last_run_id": run_id,
        "last_run_timestamp": plan.get("generated_at") or datetime.now(timezone.utc).isoformat(),
        "last_plan_status": plan_status,
        "last_dispatched_at": None,
        "last_snapshot_path": None,
        "total_runs": 1,
    }
    _write_json(AGENT_STATE, state)
    logger.info("Bootstrap: wrote agent_state.json (run_id=%s, status=%s)", run_id, plan_status)


def ensure_agent_demo_artifacts() -> dict:
    """
    Create missing agent workflow files without overwriting existing ones.

    Returns a summary dict with keys: ok, created[], message.
    """
    created: list[str] = []

    # Fast path — nothing to do
    if DAILY_PLAN.exists() and PENDING_PLAN.exists() and AGENT_STATE.exists():
        return {"ok": True, "created": [], "message": "agent artifacts already present"}

    try:
        plan: Optional[dict] = None

        if not DAILY_PLAN.exists() or not PENDING_PLAN.exists():
            plan = _resolve_plan_source()

        if not DAILY_PLAN.exists() and plan is not None:
            daily = deepcopy(plan)
            daily["status"] = "generated"
            _write_json(DAILY_PLAN, daily)
            created.append("daily_master_plan.json")

        if not PENDING_PLAN.exists():
            if plan is None:
                plan = _read_json(DAILY_PLAN) or _resolve_plan_source()
            # Use approval_queue so submitted_at / status fields match local demo flow
            from agents.approval_queue import submit_plan_for_approval

            pending_plan = deepcopy(plan)
            submit_plan_for_approval(pending_plan)
            created.append("pending_master_plan.json")

        if not AGENT_STATE.exists():
            ref = _read_json(PENDING_PLAN) or _read_json(DAILY_PLAN)
            if ref:
                status = str(ref.get("status") or "pending")
                if status not in ("pending", "generated", "approved", "dispatched"):
                    status = "pending"
                _sync_agent_state(ref, plan_status=status)
                created.append("agent_state.json")

        # eml/ is intentionally created only after dry-run dispatch — do not bootstrap

        if created:
            logger.info("Bootstrap: created %s", ", ".join(created))
            return {"ok": True, "created": created, "message": "agent demo artifacts bootstrapped"}
        return {"ok": True, "created": [], "message": "no bootstrap needed"}

    except Exception as exc:
        logger.exception("Bootstrap failed: %s", exc)
        return {"ok": False, "created": created, "message": str(exc)}


def run_agent_demo_plan(use_llm: bool = False) -> dict:
    """
    Simulate the 4 AM agent run: generate plan → submit for approval.
    Does NOT auto-approve or dispatch.
    """
    from agents.plan_generator import generate_master_plan
    from agents.approval_queue import submit_plan_for_approval
    from agents.state_manager import record_run_start, record_plan_status

    run_id = record_run_start()

    plan = generate_master_plan(
        run_id=run_id,
        allow_unassigned=True,
        use_llm=use_llm,
    )
    submit_plan_for_approval(plan)
    record_plan_status("pending")

    return {
        "ok": True,
        "run_id": run_id,
        "total_assignments": plan.get("total_assignments", 0),
        "stations": len(plan.get("stations", [])),
        "message": "Agent run complete — plan pending head-officer approval",
    }
