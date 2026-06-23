"""
File-reading helpers for the GridLock Command API.

All functions:
- Never crash when files are missing (return None / [] / {})
- Strip NaN / Infinity before returning
- Do not execute pipeline code
"""

from __future__ import annotations

import email as _email_lib
from email.header import decode_header as _decode_header, make_header as _make_header
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def _find_project_root() -> Path:
    """Resolve repo root regardless of CWD or how uvicorn was invoked."""
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (
            (candidate / "data").exists()
            and (candidate / "frontend").exists()
            and (candidate / "app").exists()
        ):
            return candidate
    # Hard fallback: app/api/readers.py → app/api → app → repo root
    return here.parents[2]


PROJECT_ROOT = _find_project_root()

# ── canonical output paths ────────────────────────────────────────────────────
HOTSPOTS_PARQUET        = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
HOTSPOTS_CSV            = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.csv"
CLUSTER_SUMMARY_PARQUET = PROJECT_ROOT / "data" / "processed" / "cluster_summary.parquet"
CLUSTER_SUMMARY_CSV     = PROJECT_ROOT / "data" / "processed" / "cluster_summary.csv"
PATROL_ROUTES      = PROJECT_ROOT / "data" / "outputs" / "patrol_routes.json"
DAILY_PLAN         = PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json"
PENDING_PLAN       = PROJECT_ROOT / "data" / "outputs" / "pending_master_plan.json"
APPROVED_PLAN      = PROJECT_ROOT / "data" / "outputs" / "approved_master_plan.json"
AGENT_STATE        = PROJECT_ROOT / "data" / "outputs" / "agent_state.json"
INFRA_CSV          = PROJECT_ROOT / "data" / "outputs" / "infra_assessment_summary.csv"
INFRA_PDF_DIR      = PROJECT_ROOT / "data" / "outputs" / "infra_escalation_pdfs"
EML_ROOT           = PROJECT_ROOT / "data" / "outputs" / "eml"
FEEDBACK_DB        = PROJECT_ROOT / "data" / "outputs" / "feedback.sqlite"


# ── utilities ─────────────────────────────────────────────────────────────────

def _clean(value: Any) -> Any:
    """Recursively replace NaN / Infinity with None for JSON safety."""
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_clean(v) for v in value]
    return value


def _read_json(path: Path) -> Optional[dict]:
    """Read a JSON file; return None if missing or unparseable."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _df_to_records(df) -> list[dict]:
    """Convert a DataFrame to a list of clean dicts."""
    import pandas as pd
    records = df.where(pd.notnull(df), None).to_dict(orient="records")
    return [_clean(r) for r in records]


# ── location enrichment ───────────────────────────────────────────────────────

_location_lookup: dict[str, dict] = {}


def _get_location_lookup() -> dict[str, dict]:
    """Lazily load cluster_summary location fields, cached for process lifetime."""
    global _location_lookup
    if _location_lookup:
        return _location_lookup
    try:
        import pandas as pd
        df = None
        if CLUSTER_SUMMARY_PARQUET.exists():
            df = pd.read_parquet(CLUSTER_SUMMARY_PARQUET)
        elif CLUSTER_SUMMARY_CSV.exists():
            df = pd.read_csv(CLUSTER_SUMMARY_CSV)
        if df is not None and not df.empty:
            for _, row in df[["cluster_id", "location_mode", "junction_name_mode"]].iterrows():
                loc = row.get("location_mode")
                jct = row.get("junction_name_mode")
                _location_lookup[str(row["cluster_id"])] = {
                    "location_mode": str(loc) if loc and loc == loc else None,
                    "junction_name_mode": str(jct) if jct and jct == jct else None,
                }
    except Exception:
        pass
    return _location_lookup


def _enrich_location(record: dict) -> dict:
    """Add location_mode and junction_name_mode from cluster_summary lookup."""
    lookup = _get_location_lookup()
    loc_data = lookup.get(record.get("cluster_id", ""), {})
    record["location_mode"] = loc_data.get("location_mode")
    record["junction_name_mode"] = loc_data.get("junction_name_mode")
    return record


# ── hotspots ──────────────────────────────────────────────────────────────────

def read_hotspots(
    station: Optional[str] = None,
    classification: Optional[str] = None,
    sort_by: str = "roi_score",
    limit: int = 100,
) -> list[dict]:
    """Read scored hotspots, apply filters, sort, limit, and clean NaN."""
    df = _read_hotspots_df()
    if df is None or df.empty:
        return []

    if station:
        df = df[df["assigned_station"].str.lower() == station.lower()]
    if classification:
        df = df[df["classification"].str.lower() == classification.lower()]

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=False, na_position="last")

    df = df.head(limit)
    return [_enrich_location(r) for r in _df_to_records(df)]


def _read_hotspots_df():
    """
    Try parquet first; fall back to CSV if parquet fails or is absent.
    Each source has its own try/except so a parquet failure does NOT skip CSV.
    Prints diagnostics to stdout (visible in uvicorn logs) on any failure.
    """
    import pandas as pd

    if HOTSPOTS_PARQUET.exists():
        try:
            df = pd.read_parquet(HOTSPOTS_PARQUET)
            print(f"[readers] hotspots: {len(df)} rows loaded from parquet", flush=True)
            return df
        except Exception as exc:
            print(
                f"[readers] WARNING parquet read failed — trying CSV fallback.\n"
                f"  path:   {HOTSPOTS_PARQUET}\n"
                f"  exists: {HOTSPOTS_PARQUET.exists()}\n"
                f"  error:  {exc}",
                flush=True,
            )

    if HOTSPOTS_CSV.exists():
        try:
            df = pd.read_csv(HOTSPOTS_CSV)
            print(f"[readers] hotspots: {len(df)} rows loaded from CSV fallback", flush=True)
            return df
        except Exception as exc:
            print(
                f"[readers] ERROR CSV read also failed.\n"
                f"  path:   {HOTSPOTS_CSV}\n"
                f"  exists: {HOTSPOTS_CSV.exists()}\n"
                f"  error:  {exc}",
                flush=True,
            )

    print(
        f"[readers] ERROR no hotspot data found — check data/outputs/.\n"
        f"  PROJECT_ROOT:   {PROJECT_ROOT}\n"
        f"  parquet exists: {HOTSPOTS_PARQUET.exists()}\n"
        f"  csv exists:     {HOTSPOTS_CSV.exists()}",
        flush=True,
    )
    return None


def read_hotspots_summary() -> dict:
    """Return aggregate stats over all hotspots."""
    df = _read_hotspots_df()
    if df is None or df.empty:
        return {"ok": False, "message": "No hotspot data available", "data": None}

    import pandas as pd
    total = len(df)
    counts = df["classification"].value_counts().to_dict() if "classification" in df.columns else {}

    def safe_mean(col):
        if col not in df.columns:
            return None
        v = df[col].mean()
        return None if (isinstance(v, float) and (math.isnan(v) or math.isinf(v))) else round(float(v), 4)

    return {
        "ok": True,
        "total_hotspots": total,
        "classification_counts": counts,
        "average_roi_score": safe_mean("roi_score"),
        "average_lcle": safe_mean("lcle_pct"),
        "average_bci": safe_mean("bci"),
        "total_violations": int(df["violation_count"].sum()) if "violation_count" in df.columns else None,
        "stations": int(df["assigned_station"].nunique()) if "assigned_station" in df.columns else None,
    }


def read_hotspot_by_id(cluster_id: str) -> Optional[dict]:
    """Return a single hotspot row or None if not found."""
    df = _read_hotspots_df()
    if df is None or df.empty:
        return None
    match = df[df["cluster_id"] == cluster_id]
    if match.empty:
        return None
    return _enrich_location(_clean(_df_to_records(match)[0]))


# ── patrol routes ─────────────────────────────────────────────────────────────

def read_routes() -> dict:
    """Return the full patrol_routes.json with safe fallback."""
    data = _read_json(PATROL_ROUTES)
    if data is None:
        return {"ok": False, "message": "patrol_routes.json not found", "data": None}
    return {"ok": True, "metadata": _clean(data.get("metadata", {})), "routes": _clean(data.get("routes", []))}


def read_route_for_station(station: str) -> Optional[dict]:
    """Return the route dict for a given station name, or None."""
    data = _read_json(PATROL_ROUTES)
    if not data:
        return None
    routes = data.get("routes", [])
    for r in routes:
        if r.get("assigned_station", "").lower() == station.lower():
            return _clean(r)
    return None


# ── master plan ───────────────────────────────────────────────────────────────

def read_plan_file(path: Path) -> dict:
    """Read a plan JSON; return structured error if missing."""
    data = _read_json(path)
    if data is None:
        return {"ok": False, "message": f"{path.name} not found", "data": None}
    return {"ok": True, "data": _clean(data)}


# ── agent state ───────────────────────────────────────────────────────────────

def read_agent_state() -> dict:
    data = _read_json(AGENT_STATE)
    if data is None:
        return {"ok": False, "message": "agent_state.json not found", "data": None}
    return {"ok": True, "data": _clean(data)}


# ── summary (command centre dashboard) ───────────────────────────────────────

def read_summary() -> dict:
    df = _read_hotspots_df()
    agent = _read_json(AGENT_STATE) or {}
    pending = _read_json(PENDING_PLAN) or {}
    approved = _read_json(APPROVED_PLAN) or {}
    daily = _read_json(DAILY_PLAN) or {}

    total_hotspots = len(df) if df is not None else 0
    counts: dict = {}
    avg_roi = avg_lcle = avg_bci = total_violations = 0.0

    if df is not None and not df.empty:
        import pandas as pd
        if "classification" in df.columns:
            counts = df["classification"].str.upper().value_counts().to_dict()
        else:
            counts = {}
        avg_roi = float(df["roi_score"].mean()) if "roi_score" in df.columns else 0.0
        avg_lcle = float(df["lcle_pct"].mean()) if "lcle_pct" in df.columns else 0.0
        avg_bci = float(df["bci"].mean()) if "bci" in df.columns else 0.0
        total_violations = int(df["violation_count"].sum()) if "violation_count" in df.columns else 0

    # plan status: approved > pending > daily > unknown
    plan_status = "unknown"
    if approved.get("status") == "approved":
        plan_status = "approved"
    elif pending.get("status") == "pending":
        plan_status = "pending"
    elif daily:
        plan_status = "generated"

    # assignments / stations come from whichever plan is available
    active_plan = approved or pending or daily
    total_assignments = active_plan.get("total_assignments", 0)
    stations_val = active_plan.get("stations", [])
    if isinstance(stations_val, dict):
        total_stations = len(stations_val)
    elif isinstance(stations_val, list):
        total_stations = len(stations_val)
    else:
        total_stations = 0

    return _clean({
        "total_hotspots":    total_hotspots,
        "structural_count":  counts.get("STRUCTURAL", 0),
        "responsive_count":  counts.get("RESPONSIVE", 0),
        "seasonal_count":    counts.get("SEASONAL", 0),
        "average_roi":       round(avg_roi, 4),
        "average_lcle":      round(avg_lcle, 4),
        "average_bci":       round(avg_bci, 4),
        "total_violations":  total_violations,
        "total_assignments": total_assignments,
        "total_stations":    total_stations,
        "plan_status":       plan_status,
        "last_run_id":       agent.get("last_run_id"),
        "m10_wired":         bool(active_plan.get("m10_wired", False)),
        "m15_wired":         bool(active_plan.get("m15_wired", False)),
        "routing_mode":      active_plan.get("m10_routing_mode"),
    })


# ── notifications (eml) ───────────────────────────────────────────────────────

def _decode_mime_words(raw: str) -> str:
    """Decode MIME encoded-word header (=?utf-8?q?...?=) to plain Unicode."""
    try:
        return str(_make_header(_decode_header(raw)))
    except Exception:
        return raw


def _kind_from_subject(subject: str) -> str:
    s = subject.lower()
    if "head officer" in s or "chief" in s or "command" in s:
        return "head_officer"
    if "tow" in s:
        return "tow"
    if "officer" in s or "assignment" in s or "patrol" in s:
        return "officer"
    return "unknown"


def _parse_eml(path: Path, idx: int) -> dict:
    try:
        msg = _email_lib.message_from_bytes(path.read_bytes())
        subject = _decode_mime_words(msg.get("Subject", ""))
        recipient = _decode_mime_words(msg.get("To", ""))
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode("utf-8", errors="replace")
        return {
            "id": f"eml_{idx:04d}",
            "filename": path.name,
            "recipient": recipient,
            "subject": subject,
            "body": body[:2000],  # cap body length for API response
            "kind": _kind_from_subject(subject),
        }
    except Exception:
        return {
            "id": f"eml_{idx:04d}",
            "filename": path.name,
            "recipient": "",
            "subject": "",
            "body": "",
            "kind": "unknown",
        }


def read_notifications(limit: int = 200) -> list[dict]:
    """Parse .eml files from the most recent run folder."""
    # 1. Try last_run_id folder
    agent = _read_json(AGENT_STATE) or {}
    last_run_id = agent.get("last_run_id")
    eml_files: list[Path] = []

    if last_run_id:
        run_dir = EML_ROOT / last_run_id
        if run_dir.exists():
            eml_files = sorted(run_dir.glob("*.eml"))

    # 2. Most recently modified folder under eml/
    if not eml_files and EML_ROOT.exists():
        subdirs = [d for d in EML_ROOT.iterdir() if d.is_dir()]
        if subdirs:
            latest = max(subdirs, key=lambda d: d.stat().st_mtime)
            eml_files = sorted(latest.glob("*.eml"))

    # 3. Recursive search
    if not eml_files and EML_ROOT.exists():
        eml_files = sorted(EML_ROOT.rglob("*.eml"))

    # 4. Empty list
    if not eml_files:
        return []

    return [_parse_eml(p, i) for i, p in enumerate(eml_files[:limit])]


# ── infra ─────────────────────────────────────────────────────────────────────

def read_infra_candidates() -> list[dict]:
    if not INFRA_CSV.exists():
        return []
    try:
        import pandas as pd
        df = pd.read_csv(INFRA_CSV)
        return _df_to_records(df)
    except Exception:
        return []


# ── feedback ──────────────────────────────────────────────────────────────────

def _sqlite_rows(db: Path, sql: str, params: tuple) -> list[dict]:
    """Execute a parameterised SELECT; return list of dicts. Never crashes."""
    import sqlite3
    try:
        conn = sqlite3.connect(str(db))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(sql, params).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def read_feedback_for_cluster(cluster_id: str) -> dict:
    """
    Return officer + citizen feedback events for a cluster, plus a summary.

    Uses parameterised queries throughout — cluster_id is never interpolated
    into SQL text, so injection is not possible.
    If the DB or either table is missing the response is empty but valid.
    """
    officer_rows: list[dict] = []
    citizen_rows: list[dict] = []

    if FEEDBACK_DB.exists():
        officer_rows = _sqlite_rows(
            FEEDBACK_DB,
            "SELECT * FROM feedback_events WHERE cluster_id = ? ORDER BY feedback_timestamp_ist ASC",
            (cluster_id,),
        )
        citizen_rows = _sqlite_rows(
            FEEDBACK_DB,
            "SELECT * FROM citizen_feedback WHERE cluster_id = ? ORDER BY created_at ASC",
            (cluster_id,),
        )

    recurred_count = sum(
        1 for r in officer_rows if r.get("recurred_after_enforcement") == 1
    )
    structural_boost = 1 if recurred_count >= 1 else 0

    return {
        "ok": True,
        "cluster_id": cluster_id,
        "officer_feedback": officer_rows,
        "citizen_feedback": citizen_rows,
        "summary": {
            "officer_event_count": len(officer_rows),
            "citizen_event_count": len(citizen_rows),
            "recurred_after_enforcement_count": recurred_count,
            "feedback_structural_boost": structural_boost,
        },
    }


def read_infra_pdfs() -> list[dict]:
    if not INFRA_PDF_DIR.exists():
        return []
    results = []
    for f in sorted(INFRA_PDF_DIR.glob("*.pdf")):
        stat = f.stat()
        results.append({
            "filename": f.name,
            "size": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "url": f"/api/infra/pdfs/{f.name}",
        })
    return results
