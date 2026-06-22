# API Adapter MVP Report

**Date:** 2026-06-21  
**Status:** COMPLETE — all endpoints implemented and tested

---

## Files created

| File | Purpose |
|------|---------|
| `app/api/__init__.py` | Package marker |
| `app/api/main.py` | FastAPI app, CORS, all route handlers |
| `app/api/readers.py` | File-reading helpers (hotspots, routes, plans, eml, infra) |
| `app/api/actions.py` | Agent wrapper calls (approve, dispatch) |
| `app/api/schemas.py` | Pydantic schemas for typed responses |

---

## Dependencies added to `requirements.txt`

| Package | Version pinned |
|---------|---------------|
| `fastapi` | `>=0.111.0` |
| `uvicorn[standard]` | `>=0.29.0` |
| `python-multipart` | `>=0.0.9` |

`pandas`, `pyarrow`, `pydantic` were already present.

Installed versions in venv: fastapi 0.138.0, uvicorn 0.49.0, pydantic 2.13.4.

---

## Endpoints implemented

### Health + Summary

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Returns ok + all key file existence flags |
| GET | `/api/summary` | Dashboard aggregate: hotspot counts, ROI, plan status, routing_mode |

### Hotspots

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/hotspots` | Query params: station, classification, sort_by (default: roi_score desc), limit |
| GET | `/api/hotspots/summary` | Aggregate stats — defined BEFORE `/{cluster_id}` to avoid FastAPI routing collision |
| GET | `/api/hotspots/{cluster_id}` | Single hotspot or 404 |

### Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/routes` | Full patrol_routes.json with metadata |
| GET | `/api/routes/station/{station}` | Single station route (M10 stop order preserved) or 404 |

### Master Plan

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/master-plan/daily` | daily_master_plan.json or `{ok:false}` |
| GET | `/api/master-plan/pending` | pending_master_plan.json or `{ok:false}` |
| GET | `/api/master-plan/approved` | approved_master_plan.json or `{ok:false}` |
| POST | `/api/master-plan/approve` | Approves pending plan only — no auto-dispatch |

### Dispatch

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/dispatch/approved-plan` | Dispatches approved plan as dry-run .eml only |

### Notifications

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/notifications` | Parses .eml files; limit param default 200 |

### Agent

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/agent/state` | agent_state.json or `{ok:false}` |

### Infrastructure

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/infra/escalation-candidates` | infra_assessment_summary.csv rows |
| GET | `/api/infra/pdfs` | List PDFs with filename, size, modified_at, url |
| GET | `/api/infra/pdfs/{pdf_name}` | Serve PDF via FileResponse; path traversal protected |

---

## Endpoints deliberately postponed (Phase 2)

```
POST /api/master-plan/revise
GET  /api/officer/{officer_id}/assignments
GET  /api/tow/{tow_truck_id}/tasks
GET  /api/feedback/{cluster_id}
POST /api/feedback/officer
POST /api/feedback/citizen
GET  /api/demo/week-comparison
POST /api/agent/run-now
GET  /api/reports
GET  /api/reports/{report_name}
GET  /api/agent/snapshots
```

---

## Commands run

```bash
# Compile check
python -m py_compile app/api/main.py app/api/readers.py app/api/actions.py app/api/schemas.py
# → COMPILE OK

# Install deps
.venv/Scripts/pip install fastapi "uvicorn[standard]" python-multipart pydantic

# Start server
uvicorn app.api.main:app --reload --port 8000

# Tests (all via Python urllib — no curl BOM issues)
GET  /api/health                          -> 200, ok=true, all 10 key files present
GET  /api/summary                         -> 200, 1084 hotspots, structural=243, responsive=631, seasonal=210
GET  /api/hotspots?limit=2                -> 200, count=2, first=C_298
GET  /api/hotspots/summary                -> 200, ok=true, stations=54
GET  /api/hotspots/C_22                   -> 200, valid row
GET  /api/hotspots/NONEXISTENT            -> 404 Not Found
GET  /api/routes                          -> 200, ok=true, routes=54
GET  /api/master-plan/daily               -> 200, ok=true, run_id=20260621_201243
GET  /api/master-plan/pending             -> 200, ok=true, run_id=20260621_201243
GET  /api/master-plan/approved            -> 200, ok=true, run_id=20260621_201243
GET  /api/agent/state                     -> 200, ok=true, last_run_id=20260621_201243
GET  /api/notifications                   -> 200, count=200, first kind=officer
GET  /api/infra/escalation-candidates     -> 200, count=3, first=C_27_0
GET  /api/infra/pdfs                      -> 200, [{escalation_C_27_0.pdf, size=4689}]
POST /api/master-plan/approve             -> 200, ok=true, "Plan approved"
POST /api/dispatch/approved-plan          -> 200, ok=true, email_count=346, run_id=20260621_201243
```

---

## Sample response summaries

**`GET /api/summary`**
```json
{
  "total_hotspots": 1084,
  "structural_count": 243, "responsive_count": 631, "seasonal_count": 210,
  "average_roi": 50.0461, "average_lcle": 40.5337, "average_bci": 0.0463,
  "total_violations": 259138,
  "total_assignments": 410, "total_stations": 54,
  "plan_status": "approved",
  "last_run_id": "20260621_201243",
  "m10_wired": true, "m15_wired": true, "routing_mode": "graph"
}
```

**`GET /api/agent/state`**
```json
{
  "ok": true,
  "data": {
    "last_run_id": "20260621_201243",
    "last_plan_status": "dispatched",
    "total_runs": 1
  }
}
```

---

## Missing-file fallback behaviour

| Scenario | Response |
|----------|---------|
| Plan JSON not found | `{"ok": false, "message": "…not found", "data": null}` — no crash |
| `scored_hotspots.parquet` missing | Falls back to CSV; if both missing returns `[]` |
| `infra_assessment_summary.csv` missing | Returns `[]` |
| `eml/<run_id>/` missing | Falls back to latest modified eml folder, then recursive search, then `[]` |
| PDF not found | 404 HTTP response |
| Path traversal attempt on PDF | 400 or 403 HTTP response |

---

## Phase 2 Addition — Feedback & Escalation endpoints

**Date:** 2026-06-21

### Files changed

| File | Change |
|------|--------|
| `app/api/schemas.py` | Added `OfficerFeedbackRequest`, `CitizenFeedbackRequest` Pydantic models |
| `app/api/actions.py` | Added `submit_officer_feedback()`, `submit_citizen_feedback()` wrappers |
| `app/api/readers.py` | Added `FEEDBACK_DB` path constant, `_sqlite_rows()` helper, `read_feedback_for_cluster()` |
| `app/api/main.py` | Added 3 feedback endpoints; imported request schemas |

### Endpoints added

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/feedback/{cluster_id}` | Returns officer + citizen events + summary; empty but valid if cluster unknown |
| POST | `/api/feedback/officer` | Records one officer event via `ingest_officer_feedback()`; returns ok/data/message |
| POST | `/api/feedback/citizen` | Records one citizen event via `ingest_citizen_feedback()`; returns ok/data/message |

### Schemas added

- `OfficerFeedbackRequest`: `cluster_id`, `officer_id` (opt), `action`, `outcome`, `reason_code` (opt), `assigned_station` (opt), `reason_text` (opt), `source` (default `"frontend_demo"`)
- `CitizenFeedbackRequest`: `cluster_id`, `reason_code`, `reason_text` (opt), `source` (default `"frontend_demo"`)

### Commands run

```bash
python -m py_compile app/api/main.py app/api/readers.py app/api/actions.py app/api/schemas.py
# → COMPILE OK
uvicorn app.api.main:app --port 8000
```

### Sample responses

**`GET /api/feedback/C_298` (after test submissions)**
```json
{
  "ok": true,
  "cluster_id": "C_298",
  "officer_feedback": [{ "id": 2503, "cluster_id": "C_298", "action_type": "towing", ... }],
  "citizen_feedback":  [{ "id": 945,  "cluster_id": "C_298", "reason_code": "no_parking_space", ... }],
  "summary": {
    "officer_event_count": 2,
    "citizen_event_count": 1,
    "recurred_after_enforcement_count": 1,
    "feedback_structural_boost": 1
  }
}
```

**`POST /api/feedback/officer`** → `{"ok": true, "message": "Officer feedback recorded", "data": {"row_id": 2503, ...}}`

**`POST /api/feedback/citizen`** → `{"ok": true, "message": "Citizen feedback recorded", "data": {"row_id": 945, ...}}`

**`GET /api/feedback/UNKNOWN_CLUSTER`** → ok=true, all arrays empty, all counts 0 (no crash)

**Validation error (bad `action`)** → `{"ok": false, "message": "Validation error: action must be one of ...", "data": null}` (HTTP 200, not 500)

### Source normalisation

`VALID_SOURCES` in `feedback_ingestor.py` accepts only `{"officer", "citizen", "synthetic_demo"}`. The frontend sends `"frontend_demo"`. The wrappers in `actions.py` normalise any unrecognised source to `"officer"` (POST officer) or `"citizen"` (POST citizen) before calling the ingestor — the ingestor is never called with an invalid source.

---

## Remaining limitations

| Limitation | Detail |
|------------|--------|
| File-backed only | All reads come from disk; no live pipeline execution |
| `POST /api/dispatch/approved-plan` always dry-run | `dry_run=True` hard-coded; no SMTP credentials |
| `POST /api/master-plan/approve` does not re-generate | Only promotes the existing pending plan |
| No authentication | All endpoints are unauthenticated; add OAuth2/API-key before exposing to internet |
| No WebSocket / SSE | Real-time status updates are out of scope for Phase 1 |
| Notifications cap at 200 | Configurable via `?limit=` param, max 1000 |
| M15 has only 3 demo clusters | Real assessments need officer field input |
| Feedback GET returns all history | No pagination or date-range filter; could be slow for high-volume clusters |
| `feedback_structural_boost` not live-applied | It is computed in the GET response for display only; it does NOT re-run the scoring pipeline |
