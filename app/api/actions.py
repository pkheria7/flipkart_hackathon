"""
Agent wrapper calls for the GridLock Command API.

All functions:
- Import agent code lazily so the API starts even without agents/ installed
- Never send real emails (dry_run=True always)
- Never run the full pipeline
- Return structured dicts with ok/message fields
"""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def approve_plan() -> dict:
    """
    Approve the current pending plan via agents.approval_queue.approve_plan().

    Does NOT auto-dispatch. Returns structured result or error.
    """
    try:
        from agents.approval_queue import approve_plan as _approve
        result = _approve()
        return {"ok": True, "message": "Plan approved", "data": result}
    except FileNotFoundError as exc:
        return {"ok": False, "message": f"No pending plan to approve: {exc}", "data": None}
    except Exception as exc:
        return {"ok": False, "message": f"Approval failed: {exc}", "data": None}


def dispatch_plan() -> dict:
    """
    Dispatch the approved plan in dry-run mode only.

    Reads the approved plan from disk, dispatches emails as .eml files.
    Never sends real SMTP. Returns structured result.
    """
    try:
        from agents.approval_queue import get_approved_plan
        from agents.dispatcher import dispatch_approved_plan

        approved = get_approved_plan()
        if not approved:
            return {"ok": False, "message": "No approved plan found. Approve first.", "data": None}

        results = dispatch_approved_plan(approved, dry_run=True)
        run_id = approved.get("run_id")
        return {
            "ok": True,
            "run_id": run_id,
            "email_count": len(results),
            "message": f"Dispatched {len(results)} dry-run emails for run_id={run_id}",
        }
    except Exception as exc:
        return {"ok": False, "message": f"Dispatch failed: {exc}", "data": None}


# ── Feedback ──────────────────────────────────────────────────────────────────
# VALID_SOURCES in feedback_ingestor is {"officer", "citizen", "synthetic_demo"}.
# The frontend sends "frontend_demo"; we normalise to the canonical source name
# ("officer" / "citizen") so the ingestor accepts the row without modification.

def submit_officer_feedback(payload: dict) -> dict:
    """
    Forward officer feedback to agents.feedback_ingestor.ingest_officer_feedback().

    Maps 'frontend_demo' source → 'officer' so the ingestor's VALID_SOURCES
    check passes.  All other validation (action/outcome/reason_code) is
    delegated to the ingestor and any ValueError is returned as ok=false.
    """
    try:
        from agents.feedback_ingestor import ingest_officer_feedback

        source = payload.get("source") or "officer"
        if source not in ("officer", "citizen", "synthetic_demo"):
            source = "officer"

        result = ingest_officer_feedback(
            cluster_id=payload["cluster_id"],
            officer_id=payload.get("officer_id") or "UNKNOWN",
            action=payload["action"],
            outcome=payload["outcome"],
            reason_code=payload.get("reason_code"),
            reason_text=payload.get("reason_text"),
            assigned_station=payload.get("assigned_station"),
            source=source,
        )
        return {"ok": True, "message": "Officer feedback recorded", "data": result}
    except (KeyError, ValueError) as exc:
        return {"ok": False, "message": f"Validation error: {exc}", "data": None}
    except Exception as exc:
        return {"ok": False, "message": f"Feedback submission failed: {exc}", "data": None}


def submit_citizen_feedback(payload: dict) -> dict:
    """
    Forward citizen feedback to agents.feedback_ingestor.ingest_citizen_feedback().

    Maps 'frontend_demo' source → 'citizen'.
    """
    try:
        from agents.feedback_ingestor import ingest_citizen_feedback

        source = payload.get("source") or "citizen"
        if source not in ("officer", "citizen", "synthetic_demo"):
            source = "citizen"

        result = ingest_citizen_feedback(
            cluster_id=payload["cluster_id"],
            reason_code=payload["reason_code"],
            reason_text=payload.get("reason_text"),
            source=source,
        )
        return {"ok": True, "message": "Citizen feedback recorded", "data": result}
    except (KeyError, ValueError) as exc:
        return {"ok": False, "message": f"Validation error: {exc}", "data": None}
    except Exception as exc:
        return {"ok": False, "message": f"Feedback submission failed: {exc}", "data": None}
