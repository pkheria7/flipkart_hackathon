"""
GridLock Command API — MVP adapter for the React frontend.

File-backed read-only API. Does NOT run the pipeline.
Start with: uvicorn app.api.main:app --reload --port 8000
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api import readers, actions
from app.api.schemas import OfficerFeedbackRequest, CitizenFeedbackRequest
from app.api.readers import (
    HOTSPOTS_PARQUET, HOTSPOTS_CSV, PATROL_ROUTES, DAILY_PLAN,
    PENDING_PLAN, APPROVED_PLAN, AGENT_STATE, INFRA_CSV,
    INFRA_PDF_DIR, EML_ROOT,
)

app = FastAPI(
    title="GridLock Command API",
    description="MVP adapter for the Flipkart Gridlock 2.0 React frontend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    key_files = {
        "scored_hotspots.parquet": HOTSPOTS_PARQUET.exists(),
        "scored_hotspots.csv":     HOTSPOTS_CSV.exists(),
        "patrol_routes.json":      PATROL_ROUTES.exists(),
        "daily_master_plan.json":  DAILY_PLAN.exists(),
        "pending_master_plan.json": PENDING_PLAN.exists(),
        "approved_master_plan.json": APPROVED_PLAN.exists(),
        "agent_state.json":        AGENT_STATE.exists(),
        "infra_assessment_summary.csv": INFRA_CSV.exists(),
        "infra_escalation_pdfs/":  INFRA_PDF_DIR.exists(),
        "eml/":                    EML_ROOT.exists(),
    }
    return {
        "ok": True,
        "service": "GridLock Command API",
        "mode": "file-backed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "key_files": key_files,
    }


# ── Summary ───────────────────────────────────────────────────────────────────

@app.get("/api/summary")
def summary():
    return readers.read_summary()


# ── Hotspots ──────────────────────────────────────────────────────────────────

@app.get("/api/hotspots/summary")
def hotspots_summary():
    """Aggregate stats — MUST be defined before /api/hotspots/{cluster_id}."""
    return readers.read_hotspots_summary()


@app.get("/api/hotspots")
def hotspots(
    station:        Optional[str] = Query(default=None),
    classification: Optional[str] = Query(default=None),
    sort_by:        str           = Query(default="roi_score"),
    limit:          int           = Query(default=100, ge=1, le=5000),
):
    return readers.read_hotspots(
        station=station,
        classification=classification,
        sort_by=sort_by,
        limit=limit,
    )


@app.get("/api/hotspots/{cluster_id}")
def hotspot_by_id(cluster_id: str):
    row = readers.read_hotspot_by_id(cluster_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_id}' not found")
    return row


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/routes")
def routes():
    return readers.read_routes()


@app.get("/api/routes/station/{station}")
def route_for_station(station: str):
    route = readers.read_route_for_station(station)
    if route is None:
        raise HTTPException(status_code=404, detail=f"No route for station '{station}'")
    return route


# ── Master Plan ───────────────────────────────────────────────────────────────

@app.get("/api/master-plan/daily")
def plan_daily():
    return readers.read_plan_file(DAILY_PLAN)


@app.get("/api/master-plan/pending")
def plan_pending():
    return readers.read_plan_file(PENDING_PLAN)


@app.get("/api/master-plan/approved")
def plan_approved():
    return readers.read_plan_file(APPROVED_PLAN)


@app.post("/api/master-plan/approve")
def approve_plan():
    """Approve the pending plan. Does NOT dispatch automatically."""
    return actions.approve_plan()


# ── Dispatch ──────────────────────────────────────────────────────────────────

@app.post("/api/dispatch/approved-plan")
def dispatch_approved():
    """Dispatch the approved plan as dry-run .eml files. Never sends real SMTP."""
    return actions.dispatch_plan()


# ── Notifications ─────────────────────────────────────────────────────────────

@app.get("/api/notifications")
def notifications(limit: int = Query(default=200, ge=1, le=1000)):
    return readers.read_notifications(limit=limit)


# ── Agent State ───────────────────────────────────────────────────────────────

@app.get("/api/agent/state")
def agent_state():
    return readers.read_agent_state()


# ── Feedback ─────────────────────────────────────────────────────────────────

@app.get("/api/feedback/{cluster_id}")
def get_feedback(cluster_id: str):
    """Return officer + citizen feedback events and summary for a cluster."""
    return readers.read_feedback_for_cluster(cluster_id)


@app.post("/api/feedback/officer")
def post_officer_feedback(body: OfficerFeedbackRequest):
    """Record one officer feedback event. Never runs the pipeline."""
    return actions.submit_officer_feedback(body.model_dump())


@app.post("/api/feedback/citizen")
def post_citizen_feedback(body: CitizenFeedbackRequest):
    """Record one citizen feedback event. Never runs the pipeline."""
    return actions.submit_citizen_feedback(body.model_dump())


# ── Infrastructure ────────────────────────────────────────────────────────────

@app.get("/api/infra/escalation-candidates")
def infra_escalation_candidates():
    return readers.read_infra_candidates()


@app.get("/api/infra/pdfs")
def infra_pdfs():
    return readers.read_infra_pdfs()


@app.get("/api/infra/pdfs/{pdf_name}")
def serve_pdf(pdf_name: str):
    # Path traversal protection: only allow plain filenames
    if "/" in pdf_name or "\\" in pdf_name or ".." in pdf_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    pdf_path = INFRA_PDF_DIR / pdf_name
    if not pdf_path.exists() or not pdf_path.is_file():
        raise HTTPException(status_code=404, detail=f"PDF '{pdf_name}' not found")
    # Confirm file is actually inside INFRA_PDF_DIR (resolve symlinks)
    if not pdf_path.resolve().is_relative_to(INFRA_PDF_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")
    return FileResponse(str(pdf_path), media_type="application/pdf", filename=pdf_name)
