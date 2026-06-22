"""
Agent state manager.

Tracks daily run IDs, plan status, and output snapshots.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATE_FILE   = PROJECT_ROOT / "data" / "outputs" / "agent_state.json"
SNAPSHOT_DIR = PROJECT_ROOT / "data" / "outputs" / "run_snapshots"

# Files snapshotted before any destructive pipeline run
_PRE_PIPELINE_FILES = {
    "scored_hotspots_parquet": PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet",
    "scored_hotspots_csv":     PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.csv",
    "patrol_routes_json":      PROJECT_ROOT / "data" / "outputs" / "patrol_routes.json",
    "patrol_routes_csv":       PROJECT_ROOT / "data" / "outputs" / "patrol_routes.csv",
    "enriched_clusters":       PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet",
    "feedback_db":             PROJECT_ROOT / "data" / "outputs" / "feedback.sqlite",
}

# Files also snapshotted after a successful run (adds the new plan)
_POST_RUN_EXTRA = {
    "daily_master_plan": PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json",
}


def _ensure_dirs() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict:
    _ensure_dirs()
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {
        "last_run_id":          None,
        "last_run_timestamp":   None,
        "last_plan_status":     None,
        "last_dispatched_at":   None,
        "last_snapshot_path":   None,
        "total_runs":           0,
    }


def save_state(state: dict) -> None:
    _ensure_dirs()
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")


def new_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def record_run_start() -> str:
    state = load_state()
    run_id = new_run_id()
    state["last_run_id"]        = run_id
    state["last_run_timestamp"] = datetime.now(timezone.utc).isoformat()
    state["last_plan_status"]   = "running"
    state["total_runs"]         = state.get("total_runs", 0) + 1
    save_state(state)
    return run_id


def record_plan_status(status: str) -> None:
    allowed = {"pending", "approved", "revised", "dispatched", "failed"}
    if status not in allowed:
        raise ValueError(f"status must be one of {allowed}")
    state = load_state()
    state["last_plan_status"] = status
    save_state(state)


def update_run_id(run_id: str) -> None:
    """
    Update last_run_id in agent_state.json without incrementing total_runs.

    Called by generate_master_plan() so agent_state stays consistent with the
    plan files regardless of whether the full scheduler is used.
    """
    state = load_state()
    state["last_run_id"] = run_id
    if state.get("last_run_timestamp") is None:
        state["last_run_timestamp"] = datetime.now(timezone.utc).isoformat()
    save_state(state)


def record_dispatch() -> None:
    state = load_state()
    state["last_plan_status"]   = "dispatched"
    state["last_dispatched_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state)


def _copy_files(file_map: dict, dest_dir: Path) -> dict:
    """Copy files from file_map into dest_dir; return {name: str(dest)} for those that existed."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied: dict = {}
    for name, src in file_map.items():
        if Path(src).exists():
            dest = dest_dir / (name + Path(src).suffix)
            shutil.copy2(src, dest)
            copied[name] = str(dest)
    return copied


def snapshot_pre_pipeline(run_id: str) -> dict:
    """
    Snapshot important outputs BEFORE the pipeline overwrites them.

    Call this at the very start of a scheduled run, before run_full_pipeline().
    The snapshot is stored under run_snapshots/<run_id>/pre_pipeline/.

    Returns a dict of {name: dest_path} for each file copied.
    """
    _ensure_dirs()
    dest_dir = SNAPSHOT_DIR / run_id / "pre_pipeline"
    copied = _copy_files(_PRE_PIPELINE_FILES, dest_dir)

    state = load_state()
    state["last_snapshot_path"] = str(dest_dir)
    save_state(state)

    if copied:
        print(f"[STATE] Pre-pipeline snapshot → {dest_dir} ({len(copied)} files)")
    else:
        print("[STATE] Pre-pipeline snapshot: no existing outputs to snapshot yet")
    return copied


def snapshot_outputs(run_id: str) -> dict:
    """
    Snapshot outputs AFTER a successful run (backward-compatible version).

    Stores under run_snapshots/<run_id>/ (flat, without pre_pipeline sub-dir).
    Includes pre-pipeline files + new daily_master_plan.json.
    """
    _ensure_dirs()
    dest_dir = SNAPSHOT_DIR / run_id
    all_files = {**_PRE_PIPELINE_FILES, **_POST_RUN_EXTRA}
    copied = _copy_files(all_files, dest_dir)

    state = load_state()
    state["last_snapshot_path"] = str(dest_dir)
    save_state(state)

    return copied
