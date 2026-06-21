# End-to-End Agent Workflow

> This document describes the complete backend flow of the parking intelligence agent: how data moves from the daily 4 AM trigger through the pipeline, plan approval, dispatch, feedback collection, and back into the next day's scoring.

---

## Overview

The system is fully backend-driven. There is no UI yet. The agent orchestrates the existing data pipeline, generates a daily command plan for the head officer, dispatches assignments after approval, collects feedback, and uses that feedback to improve future plans.

```
Daily 4 AM trigger
    │
    ▼
Run full pipeline
    │
    ▼
Generate master plan
    │
    ▼
Head officer approves / revises
    │
    ▼
Dispatch to officers & tow trucks
    │
    ▼
Collect feedback
    │
    ▼
Next day: feedback influences scoring
```

---

## 1. Daily trigger at 4:00 AM

**File:** `agents/scheduler.py`

Every day at 4:00 AM, `daily_job()` is triggered by APScheduler:

```python
def daily_job(dry_run: bool = True):
    run_full_pipeline()
    plan = generate_master_plan()
    submit_plan_for_approval(plan)
```

To run it manually:

```bash
python agents/scheduler.py --now
```

The scheduler records the run in:
- `data/outputs/agent_state.json`

---

## 2. Pipeline run

**File:** `agents/pipeline_runner.py`

`run_full_pipeline()` executes the existing pipeline modules in order:

| Step | File | Output |
|---|---|---|
| P1 Clean | `pipeline/01_clean.py` | `data/processed/cleaned_violations.parquet` |
| P2 Cluster | `pipeline/02_cluster.py` | `data/processed/cluster_summary.parquet` |
| M3 Peak Windows | `pipeline/03a_peak_windows.py` | `data/processed/cluster_peak_windows.parquet` |
| M4 Classify | `pipeline/03b_classify_hotspots.py` | `data/processed/cluster_classification.parquet` |
| M18 Jurisdiction | `pipeline/03_jurisdiction.py` | `data/processed/jurisdiction_clusters.parquet` |
| Prakhar Merge | `pipeline/03c_merge_prakhar_features.py` | `data/processed/prakhar_cluster_features.parquet` |
| P4 OSM Enrich | `pipeline/04_enrich_osm.py` | `data/processed/enriched_clusters.parquet` |
| M2 LCLE Score | `pipeline/05_score.py` | updates `enriched_clusters.parquet` with LCLE |
| M7 BCI | `pipeline/m7_bci.py` | updates `enriched_clusters.parquet` with BCI |
| M1 ROI Ranker | `pipeline/m1_roi_ranker.py` | `data/outputs/scored_hotspots.parquet` |

The final output is the ranked hotspot table:
- `data/outputs/scored_hotspots.parquet`

Each row is one of 1,084 hotspots with columns like `roi_score`, `classification`, `recommended_action`, `peak_window`, `assigned_station`, `lcle_pct`, `bci`, etc.

---

## 3. Master plan generation

**File:** `agents/plan_generator.py`

After the pipeline finishes, `generate_master_plan()` reads `scored_hotspots.parquet` plus the officer and tow-truck rosters, then builds a command-level daily plan.

For each police station:
- Pick the top-N hotspots by `roi_score`
- Assign a specific officer from that station
- Assign a tow truck if the hotspot is `STRUCTURAL`
- Build a time window and reason string

Output files:
- `data/outputs/daily_master_plan.json`
- `reports/DAILY_MASTER_PLAN.md`

Example assignment entry:

```json
{
  "cluster_id": "C_298",
  "time_window": "17:00-19:00",
  "officer_id": "OFF_KORAMANGALA_01",
  "officer_name": "Ramesh",
  "tow_truck_id": "TOW_KORAMANGALA_02",
  "action": "Recurring patrol + towing support + signage/infra review",
  "reason": "ROI=87.2, LCLE=51.3%, BCI=0.691, class=STRUCTURAL"
}
```

---

## 4. Head officer approval

**File:** `agents/approval_queue.py`

The generated plan is saved as **pending**:
- `data/outputs/pending_master_plan.json`

The head officer (ACP/JCT) reviews the plan and either:
- **Approves** it → `approve_plan()` copies it to `data/outputs/approved_master_plan.json`
- **Revises** it → `revise_plan(updated_plan)` updates assignments, then approves

In the synthetic demo, approval is simulated with:

```python
simulate_head_approval()
```

In production, this would be a UI screen where the head officer clicks Approve or Revise.

---

## 5. Dispatch to officers and tow trucks

**File:** `agents/dispatcher.py`

Once approved, `dispatch_approved_plan()` sends targeted instructions:

- **Head officer** — full daily summary (sent at 4 AM)
- **Each officer** — only their own assignments, time, location, action, reason
- **Each tow-truck driver** — only their towing tasks

**File:** `agents/mailer.py`

The mailer uses SMTP but defaults to `dry_run=True`, which writes `.eml` files instead of sending real emails:
- `data/outputs/eml/`

To enable real email sending, set these environment variables:

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export FROM_EMAIL="btp-parking-agent@example.com"
export HEAD_OFFICER_EMAIL="head.officer@btp.gov.in"
```

---

## 6. Feedback collection

**File:** `agents/feedback_ingestor.py`

After patrols, two types of feedback are captured.

### Officer feedback

```python
ingest_officer_feedback(
    cluster_id="C_298",
    officer_id="OFF_KORAMANGALA_01",
    action="towed",              # towed / warned / could_not_enforce
    outcome="recurred",          # resolved / recurred / no_violation
    reason_code="no_parking_space",
    assigned_station="Koramangala",
)
```

Stored in `data/outputs/feedback.sqlite` → table `feedback_events`.

### Citizen feedback

```python
ingest_citizen_feedback(
    cluster_id="C_298",
    reason_code="no_parking_space",
)
```

Stored in `data/outputs/feedback.sqlite` → table `citizen_feedback`.

Both tables support `source = 'synthetic_demo'` for demo events.

---

## 7. Feedback summary and structural boost

**File:** `app/officer/feedback_backend.py`

`get_feedback_summary_for_scoring()` reads `feedback_events` and produces a summary:

| cluster_id | feedback_event_count | enforcement_done_count | recurred_after_enforcement_count | feedback_structural_boost |
|---|---|---|---|---|
| C_298 | 3 | 3 | 2 | 1 |
| C_149 | 1 | 1 | 0 | 0 |

`feedback_structural_boost = 1` when enforcement was performed but the hotspot recurred.

This summary is merged into `data/processed/enriched_clusters.parquet` by `pipeline/05_score.py`.

---

## 8. Feedback influences the next day's run

The next day at 4 AM, the pipeline runs again. In `pipeline/m1_roi_ranker.py`:

```python
df["feedback_structural_boost"] = df["feedback_structural_boost"].fillna(0).astype(int)
structural_mask = df["feedback_structural_boost"] == 1

if structural_mask.any():
    df.loc[structural_mask, "classification"] = "STRUCTURAL"
    df.loc[structural_mask, "recommended_action"] = (
        "Recurring patrol + towing support + signage/infra review"
    )
```

Also, recurrence gets a small boost in the ROI formula:

```python
boost = df["feedback_structural_boost"].fillna(0).astype(float)
recurrence = (recurrence * (1.0 + 0.025 * boost)).clip(0, 1)
```

So a cluster that recurred:
1. Is reclassified to `STRUCTURAL`
2. Receives the stronger recommended action
3. Gets a slight `roi_score` boost
4. Ranks higher in the next day's master plan

---

## 9. Two-week demo flow

**File:** `demo/run_two_week_demo.py`

The demo simulates the full cycle twice to prove proactive improvement.

### Week 1
1. Generate synthetic officers (`demo/synth_officers.py`)
2. Generate synthetic tow trucks (`demo/synth_tow_trucks.py`)
3. Generate synthetic `scored_hotspots` with jittered counts (`demo/synth_weekly_scores.py`)
4. Generate master plan (`agents/plan_generator.py`)
5. Simulate approval + dispatch (`agents/approval_queue.py`, `agents/dispatcher.py`)
6. Generate synthetic feedback (`demo/synth_feedback.py`)

### Week 2
1. Read Week 1 feedback
2. Generate new synthetic `scored_hotspots`:
   - Resolved clusters: violations reduced by 30–50%
   - Recurred clusters: violations similar or slightly higher
3. Escalate recurred clusters to `STRUCTURAL`
4. Generate Week 2 master plan
5. Simulate approval + dispatch

Output files:
- `data/outputs/synthetic_demo/week_1_scored_hotspots.parquet`
- `data/outputs/synthetic_demo/week_2_scored_hotspots.parquet`
- `reports/WEEK_1_VS_WEEK_2_DEMO_REPORT.md`

After the demo, real `scored_hotspots.parquet` is restored by re-running `pipeline/m1_roi_ranker.py`.

---

## 10. Complete data flow diagram

```
4:00 AM
  │
  ▼
┌─────────────────────────────┐
│  agents/scheduler.py        │
│  daily_job()                │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  agents/pipeline_runner.py  │
│  run_full_pipeline()        │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  data/outputs/              │
│  scored_hotspots.parquet    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  agents/plan_generator.py   │
│  generate_master_plan()     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  data/outputs/              │
│  daily_master_plan.json     │
│  pending_master_plan.json   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  agents/approval_queue.py   │
│  approve_plan() / revise()  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  data/outputs/              │
│  approved_master_plan.json  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  agents/dispatcher.py       │
│  dispatch_approved_plan()   │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────────┐   ┌─────────────┐
│ Officer     │   │ Tow Truck   │
│ email       │   │ email       │
└──────┬──────┘   └──────┬──────┘
       │                 │
       ▼                 ▼
┌─────────────────────────────┐
│  Patrols & enforcement      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  agents/feedback_ingestor.py│
│  officer + citizen feedback │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  data/outputs/feedback.sqlite│
│  feedback_events            │
│  citizen_feedback           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  app/officer/               │
│  feedback_backend.py        │
│  get_feedback_summary_for_scoring()│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  data/processed/            │
│  enriched_clusters.parquet  │
│  +feedback_structural_boost │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Next day 4:00 AM pipeline  │
│  recurred → STRUCTURAL      │
│  resolved → lower violations│
└─────────────────────────────┘
```

---

## 11. Files involved in the workflow

| File | Role |
|---|---|
| `agents/scheduler.py` | Daily 4 AM trigger |
| `agents/pipeline_runner.py` | Orchestrates existing pipeline |
| `agents/plan_generator.py` | Builds daily master plan |
| `agents/approval_queue.py` | Head-officer approve/revise state |
| `agents/dispatcher.py` | Sends plan to officers/trucks |
| `agents/mailer.py` | SMTP / dry-run `.eml` writer |
| `agents/feedback_ingestor.py` | Officer + citizen feedback API |
| `agents/state_manager.py` | Run state and snapshots |
| `demo/run_two_week_demo.py` | Full synthetic demo orchestrator |
| `demo/synth_*.py` | Synthetic data generators |
| `pipeline/m1_roi_ranker.py` | Applies feedback structural boost |
| `app/officer/feedback_backend.py` | Feedback summary computation |

---

## 12. Important notes

- The entire workflow is backend-only. There is no UI yet.
- Real email sending is disabled by default (`dry_run=True`).
- Synthetic demo data is tagged `source = 'synthetic_demo'`.
- The approval step keeps the human in the loop; the agent recommends but does not autonomously dispatch.
- For live deployment, replace the synthetic demo data with a daily BTP violation feed.
