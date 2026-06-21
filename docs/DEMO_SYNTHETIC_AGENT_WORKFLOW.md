# Demo: Synthetic 2-Week Agent Workflow

> This document describes the hackathon demo plan for showing a **proactive, agent-driven enforcement system** using synthetic data. The demo runs a 2-week simulation to prove the closed feedback loop: the agent recommends patrols, officers act, feedback is captured, and the system improves its recommendations.

---

## 1. Why synthetic data?

The real dataset covers **November 2023 – April 2024** only. There is no live BTP feed, no real officer roster, and only one real feedback event (`C_0_0`).

To demonstrate the **proactive vision**, we simulate:
- A 7-day incoming violation stream
- Fake officer profiles and patrol events
- Synthetic officer and citizen feedback

**All synthetic rows are tagged with `source = 'synthetic_demo'`** so they can be removed when live data arrives.

---

## 2. Demo narrative (2 weeks)

### Week 1 — Baseline + reactive response
1. Agent runs every morning at 4:00 AM.
2. It ingests the last 7 days of violations.
3. It runs the full pipeline: cleaning → clustering → OSM enrichment → LCLE → BCI → ROI scoring.
4. It generates daily patrol briefs per police station.
5. Fake officers patrol the recommended hotspots.
6. Feedback is captured: resolved, recurred, or no violation found.

### Week 2 — Proactive improvement
1. Agent re-runs with Week 1 feedback included.
2. Recurred hotspots are escalated to **STRUCTURAL**.
3. Successfully enforced hotspots show reduced violation counts.
4. Agent refocuses patrols on remaining high-ROI / recurring hotspots.
5. Dashboard compares Week 1 vs Week 2.

### Key message
> *“Week 1 shows the agent identifying hotspots. Week 2 shows the simulated outcome if officers followed the briefs — recurring hotspots are escalated, enforced areas see reduced violations. This is a simulation of the closed feedback loop, not a claim of real-world impact.”*

---

## 3. Synthetic data generation

### 3.1 Week 1 violation stream
- Start from the historical `scored_hotspots.parquet`.
- For each cluster, generate 7 days of violation counts using **Poisson sampling** around its historical daily rate.
- Bias the generation toward each cluster’s known peak day and peak hour.
- Add ±20% random noise so the data does not look copy-pasted.
- Output: `data/processed/synthetic_week_1_violations.parquet`

### 3.2 Fake officer profiles
- Create 5–10 officer profiles per station.
- Fields: `officer_id`, `name`, `assigned_station`, `phone`, `shift`.
- Output: `data/processed/synthetic_officers.csv`

### 3.3 Week 1 patrol events and feedback
For each high-ROI hotspot assigned to a patrol, generate a random outcome:

| Outcome | Probability | Meaning |
|---|---|---|
| `resolved` | 70% | Enforcement worked; no recurrence |
| `recurred` | 20% | Violations came back; needs structural action |
| `no_violation_found` | 10% | Nothing to enforce at that time |

Adjust probabilities by classification:
- STRUCTURAL clusters: higher recurrence rate (~40%)
- RESPONSIVE clusters: higher resolution rate (~80%)

Output: `data/outputs/feedback.sqlite` (synthetic rows tagged)

### 3.4 Week 2 violation stream
For each cluster, adjust the synthetic violation count based on Week 1 feedback:

| Week 1 outcome | Week 2 impact |
|---|---|
| `resolved` | Reduce violations by 30–50% |
| `recurred` | Keep similar or increase by 10–20% |
| `not patrolled` | Keep similar to historical baseline |

Add noise so the trend is realistic, not perfectly linear.
Output: `data/processed/synthetic_week_2_violations.parquet`

---

## 4. Agent workflow

### 4.1 Scheduler
A simple cron job or APScheduler triggers the agent at 4:00 AM daily:

```bash
0 4 * * * cd /path/to/project && python pipeline/daily_agent.py
```

### 4.2 Daily agent steps
```python
def run_daily_agent():
    # 1. Ingest last 7 days of violations
    ingest_last_7_days()

    # 2. Run existing pipeline functions
    run_phase1.main()
    p2_cluster.cluster_data()
    p3_peak_windows.generate_peak_windows()
    p4_enrich_osm.enrich()
    m2_score.score_lcle()
    m7_bci.compute_bci()
    m1_roi_ranker.run_m1()

    # 3. Generate daily patrol briefs
    briefs = generate_daily_briefs()

    # 4. Send notifications
    send_notifications(briefs)

    # 5. Save daily snapshot
    save_daily_snapshot(briefs)
```

### 4.3 Daily brief generation
For each police station:
- Filter hotspots whose peak window falls on today.
- Pick top-5 by ROI score.
- Assign nearest fake officer/truck.
- Generate human-readable reason for each recommendation.

Output: `data/outputs/daily_patrol_briefs.json` + `reports/DAILY_PATROL_BRIEF.md`

### 4.4 Notification dispatch
For hackathon demo, notifications are mocked (printed/saved as JSON). Later they become real SMS/WhatsApp via Twilio or push notifications via Firebase.

Example message:
```
Officer Ramesh (Koramangala Station):
Deploy to C_298 during 17:00–19:00.
Action: Recurring patrol + towing support.
Reason: LCLE=51%, BCI=0.69, recurring weekday peak.
```

---

## 5. Feedback loop

### 5.1 Officer feedback
After each patrol:
- `cluster_id`
- `officer_id`
- `action`: towed / warned / could_not_enforce
- `outcome`: resolved / recurred / no_violation
- `reason_code`: no_parking_space / loading / broke_down / ignored_sign
- `timestamp`
- `source`: synthetic_demo

### 5.2 Citizen feedback
During or after challan:
- `cluster_id`
- `reason_code`: no_parking_space / customer_waiting / loading
- `reason_text` (optional)
- `timestamp`
- `source`: synthetic_demo

### 5.3 Cross-validation
If citizen reports *“no parking space”* AND officer reports *“recurred”* for the same cluster, the system applies a stronger structural boost.

### 5.4 Incremental knowledge
Every 4 AM run:
1. Reads new feedback from last 24 hours.
2. Updates `feedback_structural_boost` in `feedback.sqlite`.
3. Re-runs pipeline; M1 reads the boost and adjusts classification/action.
4. Stores snapshot of daily briefs for trend analysis.

---

## 6. Comparison dashboard (Week 1 vs Week 2)

| Metric | Week 1 | Week 2 | Change |
|---|---|---|---|
| Total violations | 12,400 | 9,800 | -21% |
| High-ROI patrols completed | 35 | 42 | +20% |
| Recurring hotspots | 18 | 7 | -61% |
| Structural escalations | 3 | 9 | +200% |
| Avg ROI of patrolled clusters | 72 | 81 | +12% |

**Important:** Include a counterfactual line showing the projected trend **without** the agent’s intervention.

---

## 7. Honest framing for judges

> *“We built this on historical BTP data to prove the engine works. Because we don’t have a live data feed yet, this 2-week demo uses synthetic data generated from historical patterns. Week 1 shows the agent identifying hotspots and dispatching patrols. Week 2 shows the simulated outcome if those patrols were executed — recurring hotspots are escalated, and successfully enforced areas see reduced violations. The gray line shows the projected baseline without intervention. This is not a claim of real-world impact; it demonstrates the closed feedback loop the system would create with live data.”*

---

## 8. What stays real vs synthetic

| Component | Real | Synthetic |
|---|---|---|
| Historical violation data | ✅ | |
| Pipeline logic (LCLE, BCI, ROI) | ✅ | |
| Clustering and enrichment | ✅ | |
| Validation reports | ✅ | |
| Week 1/2 violation counts | | ✅ |
| Officer profiles | | ✅ |
| Patrol events | | ✅ |
| Feedback events | | ✅ |
| Counterfactual baseline | | ✅ |

---

## 9. Files to create

1. `docs/DEMO_SYNTHETIC_AGENT_WORKFLOW.md` — this document
2. `pipeline/synth_week_1_violations.py` — generate Week 1 synthetic violations
3. `pipeline/synth_officers.py` — generate fake officer profiles
4. `pipeline/synth_week_1_feedback.py` — generate Week 1 patrol/feedback events
5. `pipeline/synth_week_2_violations.py` — generate Week 2 violations based on Week 1 feedback
6. `pipeline/daily_agent.py` — scheduler-triggered agent
7. `pipeline/generate_daily_brief.py` — per-station patrol brief generator
8. `pipeline/send_notifications.py` — mock notification dispatcher
9. `app/screens/demo_week_comparison.py` — Streamlit comparison dashboard (optional)
10. `reports/WEEK_1_VS_WEEK_2_DEMO_REPORT.md` — generated comparison report

---

## 10. Bottom line

Use synthetic data for the demo, but keep the pipeline and historical analysis real. Frame the 2-week comparison as a **simulation of the closed feedback loop**, not proof of real-world impact. This gives a powerful proactive demo without losing credibility.
