# Backend Handover & UI Specification

> This document is the handover guide for the backend team to the UI/demo team. It explains what the backend produces, how the agent orchestrates the pipeline, and what screens the UI must build.

---

## 1. Project overview

The backend turns raw BTP traffic violation data into ranked, actionable parking enforcement recommendations. It is a **rule-based / geospatial intelligence engine** — no ML is required.

**Core value proposition:**
> Don't patrol by raw violation count. Patrol by ROI = impact per officer hour.

---

## 2. Backend architecture

```
Raw violation CSV
    ↓
pipeline/01_clean.py
    ↓
pipeline/02_cluster.py
    ↓
pipeline/03a_peak_windows.py   ← M3
pipeline/03b_classify_hotspots.py ← M4
pipeline/03_jurisdiction.py    ← M18
pipeline/03c_merge_prakhar_features.py
    ↓
pipeline/04_enrich_osm.py      ← P4
    ↓
pipeline/05_score.py           ← M2 LCLE
pipeline/m7_bci.py             ← M7 BCI
    ↓
pipeline/m1_roi_ranker.py      ← M1 ROI Ranker
    ↓
data/outputs/scored_hotspots.parquet
```

The **agent layer** (`agents/`) wraps this pipeline and adds:
- Daily 4 AM scheduling
- Master plan generation
- Head-officer approval workflow
- Per-recipient email dispatch
- Feedback ingestion

The **demo layer** (`demo/`) generates synthetic 2-week data to prove the proactive loop.

---

## 3. Key output files

| File | Purpose | Consumer |
|---|---|---|
| `data/outputs/scored_hotspots.parquet` | Final ranked hotspots with ROI, LCLE, BCI, peak window, classification, recommended action | Priority board, junction detail, city map |
| `data/outputs/daily_master_plan.json` | Command-level daily plan per station with officer/truck assignments | Head officer approval screen |
| `reports/DAILY_MASTER_PLAN.md` | Human-readable master plan | Head officer email / dashboard |
| `data/outputs/eml/*.eml` | Mock email files generated in dry-run mode | Notification preview screen |
| `data/outputs/feedback.sqlite` | Officer and citizen feedback events | Feedback loop, reclassification |
| `data/outputs/agent_state.json` | Last run timestamp, plan status, dispatch history | Admin / run logs screen |
| `data/outputs/run_snapshots/` | Daily snapshots of scored_hotspots and master plans | Trend dashboard |

---

## 4. `scored_hotspots.parquet` schema

| Column | Type | Meaning |
|---|---|---|
| `cluster_id` | string | Unique hotspot ID |
| `centroid_lat` | float | Hotspot latitude |
| `centroid_lng` | float | Hotspot longitude |
| `assigned_station` | string | Police station responsible |
| `border_flag` | int | 0/1 boundary flag (stubbed to 0) |
| `road_class` | string | OSM road class |
| `road_width_m` | float | Road width in meters |
| `osm_coverage` | int | 1 if width derived from OSM, else 0 |
| `violation_count` | int | Total violations in cluster |
| `vehicle_mix` | string | e.g. `CAR:12,SCOOTER:40` |
| `lcle_pct` | float | Lane Clearance Loss Estimate (0–100) |
| `bci` | float | Betweenness Centrality Index (0–1) |
| `persistence` | float | Violations per hour in peak window |
| `recurrence` | float | Active weeks / max active weeks |
| `peak_window` | string | Recommended patrol time window |
| `roi_score` | float | 0–100 final ranking score |
| `classification` | string | STRUCTURAL / RESPONSIVE / SEASONAL |
| `recommended_action` | string | Action to take |

---

## 5. Agent workflow

### 5.1 Daily 4 AM run
```
agents/scheduler.py → daily_job()
  ├─ agents/pipeline_runner.py → run_full_pipeline()
  ├─ agents/plan_generator.py → generate_master_plan()
  └─ agents/approval_queue.py → submit_plan_for_approval(plan)
```

### 5.2 Head officer approval
```
UI calls agents/approval_queue.py
  ├─ get_pending_plan()  → show plan
  ├─ approve_plan()      → approve as-is
  └─ revise_plan(plan)   → head officer edits assignments
```

### 5.3 Dispatch after approval
```
UI calls agents/dispatcher.py
  ├─ dispatch_head_officer(plan)      → sent at 4 AM with plan
  └─ dispatch_approved_plan(plan)     → sent after approval to officers/trucks
```

### 5.4 Manual run
```bash
python agents/scheduler.py --now
```

---

## 6. Feedback API

Use `agents/feedback_ingestor.py`:

```python
from agents.feedback_ingestor import ingest_officer_feedback, ingest_citizen_feedback

# Officer feedback
ingest_officer_feedback(
    cluster_id="C_298",
    officer_id="OFF_KORA_01",
    action="towed",            # towed / warned / could_not_enforce
    outcome="recurred",        # resolved / recurred / no_violation
    reason_code="no_parking_space",
    assigned_station="Koramangala",
)

# Citizen feedback
ingest_citizen_feedback(
    cluster_id="C_298",
    reason_code="no_parking_space",
)
```

When `feedback_structural_boost = 1`, the next pipeline run pushes the cluster to STRUCTURAL.

---

## 7. Mail configuration

Set environment variables:

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export FROM_EMAIL="btp-parking-agent@example.com"
export HEAD_OFFICER_EMAIL="head.officer@btp.gov.in"
```

Default mode is `dry_run=True`, which writes `.eml` files instead of sending real emails.

### LLM explanations and Kannada translation

Set:

```bash
export GROQ_API_KEY="gsk_..."
```

If set, the agent uses Groq LLaMA to:
- Generate plain-English explanations of why each hotspot is prioritized
- Translate those explanations into Kannada (ಕನ್ನಡ)

If `GROQ_API_KEY` is not set, the system falls back to template-based explanations and marks Kannada as unavailable.
LLM outputs are cached in `data/outputs/llm_cache.json` to avoid repeated API calls.

---

## 8. Demo mode

Run the full 2-week synthetic demo:

```bash
python demo/run_two_week_demo.py
```

Outputs:
- `data/outputs/synthetic_demo/week_1_scored_hotspots.parquet`
- `data/outputs/synthetic_demo/week_2_scored_hotspots.parquet`
- `reports/WEEK_1_VS_WEEK_2_DEMO_REPORT.md`

All synthetic feedback rows are tagged `source = 'synthetic_demo'`.

---

## 9. What the UI team must build

See `docs/UI_DEMO_REQUIREMENTS.md` for screen-by-screen specs.

High-level screens:
1. **Head officer login**
2. **Daily master plan inbox** — view 4 AM generated plan
3. **Plan approval / revision** — approve or edit officer/truck assignments
4. **Officer mobile view** — my assignments today
5. **Tow truck driver view** — my towing tasks today
6. **Officer feedback form**
7. **Citizen feedback form**
8. **Week 1 vs Week 2 dashboard**
9. **Agent run logs**

---

## 10. Deployment notes

- Python 3.10+
- Install deps: `pip install -r requirements.txt`
- The OSM graph (`references/bengaluru_drive.graphml`) and BCI cache (`references/node_betweenness.json`) are large but cached.
- For live deployment, replace synthetic demo data with a daily BTP data feed.
- Keep the human in the loop: the agent recommends; the head officer approves.
