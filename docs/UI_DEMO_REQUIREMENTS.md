# UI Demo Requirements

> This document specifies the screens and interactions needed for the hackathon demo. The backend is complete; these are the UI screens that consume backend outputs.

---

## 1. Screen: Head Officer Login

**Purpose:** Authenticate the ACP/JCT who approves daily plans.

**Fields:**
- Username / badge ID
- Password
- Station / jurisdiction selector

**Backend needs:**
- Hardcoded demo credentials or simple auth

---

## 2. Screen: Daily Master Plan Inbox

**Purpose:** Show the 4 AM generated plan waiting for approval.

**Data source:**
- `data/outputs/daily_master_plan.json`
- `reports/DAILY_MASTER_PLAN.md`

**Contents:**
- Date and generation time
- Total assignments
- Per-station summary
- Table: Time | Cluster | Officer | Tow Truck | Action | Reason
- Buttons: **Approve Plan** | **Revise Plan**

**Interactions:**
- Click **Approve Plan** → call `agents/approval_queue.approve_plan()` → trigger dispatch
- Click **Revise Plan** → open revision screen

---

## 3. Screen: Plan Approval / Revision

**Purpose:** Allow head officer to edit assignments before dispatch.

**Data source:**
- `data/outputs/pending_master_plan.json`

**Contents:**
- Editable table of assignments
- Dropdown to reassign officer
- Dropdown to reassign tow truck
- Option to remove an assignment
- Option to add a new assignment from a ranked hotspot list

**Interactions:**
- Save revision → call `agents/approval_queue.revise_plan(updated_plan)`
- Approve revised plan → call `agents/approval_queue.approve_plan()`

---

## 4. Screen: Officer Mobile View

**Purpose:** Show an individual officer only their own assignments.

**Data source:**
- `data/outputs/approved_master_plan.json`
- Filter by `officer_id`

**Contents:**
- Today's date
- List of assignments:
  - Time window
  - Cluster ID
  - Location (lat/lng or landmark)
  - Action
  - Reason
  - **Plain-English explanation** (from LLM)
  - **Kannada explanation** (from LLM)
  - Tow truck support (if any)
- Button: **Mark as Done** → opens feedback form

---

## 5. Screen: Tow Truck Driver View

**Purpose:** Show a tow truck driver their towing tasks.

**Data source:**
- `data/outputs/approved_master_plan.json`
- Filter by `tow_truck_id`

**Contents:**
- Today's date
- List of towing tasks:
  - Time window
  - Cluster ID
  - Location
  - Supporting officer
- Button: **Task Complete**

---

## 6. Screen: Officer Feedback Form

**Purpose:** Capture outcome of a patrol.

**Fields:**
- Cluster ID (pre-filled)
- Officer ID (pre-filled)
- Action taken: Towed / Warned / Could not enforce
- Outcome: Resolved / Recurred / No violation found
- Reason observed: No parking space / Loading / Broke down / Ignored sign / Other
- Notes (optional)

**Backend call:**
```python
agents.feedback_ingestor.ingest_officer_feedback(...)
```

---

## 7. Screen: Citizen Feedback Form

**Purpose:** Allow citizens to report why they parked illegally.

**Fields:**
- Cluster ID or location
- Reason: No parking space / Customer waiting / Loading / Other
- Optional text

**Backend call:**
```python
agents.feedback_ingestor.ingest_citizen_feedback(...)
```

---

## 8. Screen: Week 1 vs Week 2 Dashboard

**Purpose:** Demonstrate the proactive impact of the agent.

**Data source:**
- `data/outputs/synthetic_demo/week_1_scored_hotspots.parquet`
- `data/outputs/synthetic_demo/week_2_scored_hotspots.parquet`
- `reports/WEEK_1_VS_WEEK_2_DEMO_REPORT.md`

**Contents:**
- KPI cards:
  - Total violations Week 1 vs Week 2
  - Recurring hotspots
  - Structural escalations
  - Avg ROI
- Line chart: violations per day across both weeks
- Bar chart: classification distribution
- Counterfactual line: projected violations without intervention
- Disclaimer: *“Synthetic demo data based on historical patterns.”*

---

## 9. Screen: Priority Board

**Purpose:** Ranked list of all hotspots.

**Data source:**
- `data/outputs/scored_hotspots.parquet`

**Contents:**
- Toggle: Sort by ROI / Sort by Violation Count
- Table: Rank | Cluster | ROI | Violations | LCLE | BCI | Peak Window | Station | Classification
- Filters: Station | Road class | Classification
- Click row → Junction detail screen

---

## 10. Screen: Junction Detail

**Purpose:** Deep dive into a single hotspot.

**Data source:**
- `data/outputs/scored_hotspots.parquet`

**Contents:**
- Map marker
- Vehicle mix
- Road width, OSM coverage
- LCLE% with explanation
- BCI with explanation
- Persistence / recurrence
- Classification + recommended action
- Recent feedback events (from `feedback.sqlite`)

---

## 11. Screen: City Map

**Purpose:** Visual overview of all hotspots.

**Data source:**
- `data/outputs/scored_hotspots.parquet`

**Contents:**
- Folium/Mapbox map
- Dots colored by ROI score (red = high, green = low)
- Cluster markers clickable → Junction detail
- Heatmap layer option

---

## 12. Screen: Agent Run Logs

**Purpose:** Show backend health and run history.

**Data source:**
- `data/outputs/agent_state.json`
- `data/outputs/run_snapshots/`

**Contents:**
- Last run timestamp
- Last plan status (pending / approved / revised / dispatched)
- Pipeline step timings
- List of past snapshots
- Button: **Run Now** → calls `agents.scheduler.daily_job()`

---

## 13. Mock Notification Display

**Purpose:** Show what emails/SMS would look like without sending real messages.

**Data source:**
- `data/outputs/eml/*.eml`

**Contents:**
- List of generated emails
- Preview pane showing recipient, subject, body
- Indicators: head officer / officer / tow truck

---

## Demo flow for judges

1. **Login** as head officer
2. **Open daily master plan inbox** — see 4 AM generated plan
3. **Approve plan** — system dispatches emails
4. **Show mock notifications** — officer and tow truck emails
5. **Switch to officer mobile view** — see personal assignment
6. **Submit feedback** — mark patrol as recurred
7. **Show Week 1 vs Week 2 dashboard** — next week, recurred hotspot is escalated, violations drop
8. **Open priority board** — explain ROI vs count
9. **Open city map** — visual summary

---

## Tech stack recommendation

- **Framework:** Streamlit (fastest for hackathon)
- **Maps:** Folium or Plotly Mapbox
- **Charts:** Plotly or Altair
- **Email preview:** parse `.eml` files with Python `email` module
- **State:** read/write JSON files in `data/outputs/`

---

## Notes

- Keep the UI focused on the story: **proactive, jurisdiction-aware, feedback-driven enforcement.**
- Do not build user management; demo credentials are enough.
- All synthetic data must be clearly labeled as simulated.
