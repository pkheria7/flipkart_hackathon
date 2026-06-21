"""
Agent state manager.

Tracks daily run IDs, plan status, and output snapshots.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATE_FILE = PROJECT_ROOT / "data" / "outputs" / "agent_state.json"
SNAPSHOT_DIR = PROJECT_ROOT / "data" / "outputs" / "run_snapshots"


def _ensure_dirs() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict:
    _ensure_dirs()
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {
        "last_run_id": None,
        "last_run_timestamp": None,
        "last_plan_status": None,
        "last_dispatched_at": None,
        "total_runs": 0,
    }


def save_state(state: dict) -> None:
    _ensure_dirs()
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")


def new_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def record_run_start() -> str:
    state = load_state()
    run_id = new_run_id()
    state["last_run_id"] = run_id
    state["last_run_timestamp"] = datetime.now(timezone.utc).isoformat()
    state["last_plan_status"] = "running"
    state["total_runs"] = state.get("total_runs", 0) + 1
    save_state(state)
    return run_id


def record_plan_status(status: str) -> None:
    allowed = {"pending", "approved", "revised", "dispatched", "failed"}
    if status not in allowed:
        raise ValueError(f"status must be one of {allowed}")
    state = load_state()
    state["last_plan_status"] = status
    save_state(state)


def record_dispatch() -> None:
    state = load_state()
    state["last_plan_status"] = "dispatched"
    state["last_dispatched_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state)


def snapshot_outputs(run_id: str) -> dict:
    _ensure_dirs()
    snapshot = SNAPSHOT_DIR / run_id
    snapshot.mkdir(parents=True, exist_ok=True)

    files_to_snapshot = {
        "scored_hotspots": PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet",
        "master_plan": PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json",
    }
    copied = {}
    for name, path in files_to_snapshot.items():
        if path.exists():
            dest = snapshot / f"{name}{path.suffix}"
            dest.write_bytes(path.read_bytes())
            copied[name] = str(dest)
    return copied
