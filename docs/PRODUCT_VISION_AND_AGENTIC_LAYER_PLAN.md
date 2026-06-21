# Product Vision & Agentic Layer Plan

> This document captures the product discussion around what the backend currently delivers to Bangalore Traffic Police (BTP), what is still missing from the officer-facing experience, and the proposed agentic enforcement layer that wraps the existing ROI engine.

---

## 1. What the backend currently produces

The backend data-processing pipeline is complete through Phase 2 (M1 ROI Ranker + merge).

| File | What it is | Status |
|---|---|---|
| `data/outputs/scored_hotspots.parquet` | 1,084 ranked hotspots with ROI score, LCLE, BCI, peak window, assigned station, classification, recommended action | ✅ Exists |
| `reports/M1_ROI_VALIDATION_REPORT.md` | Validation of ROI distribution, divergence from count, demo-beat checks | ✅ Exists |
| `reports/PHASE2_MERGE_REPORT.md` | Column-level contract check and join validation | ✅ Exists |
| `data/outputs/patrol_routes.json` | VRP-optimized truck routes per station | ❌ Not built — `pipeline/06_optimize_vrp.py` is a placeholder |
| `data/outputs/feedback.sqlite` | Officer feedback / recurrence memory | ❌ Not built — Prakhar's M12 not implemented |

**Bottom line:** today we have a ranked table of parking hotspots plus methodology reports. We do **not** yet have a clickable dashboard, live routes, or feedback loop.

---

## 2. What the officer-facing UI should show

Based on `IMPLEMENTATION_PLAN.md`, the intended product is a **Streamlit dashboard** with four screens.

### Screen 1 — Priority Board (the main screen)
A table of hotspots sorted by `roi_score`. The ACP/officer sees:
- Location (lat/lng mapped to junction/landmark)
- ROI score
- Peak patrol window
- Recommended action
- Classification (STRUCTURAL vs RESPONSIVE)

**Key interaction:** a toggle `[Sort by ROI]` vs `[Sort by Violation Count]`.  
This is the core demo beat: *“Don’t send your 4 trucks to the place with the most tickets; send them to the place with the most impact per officer hour.”*

### Screen 2 — Junction Detail
Click a hotspot → full breakdown:
- Vehicle mix
- Road width + OSM coverage
- LCLE% (lane blockage)
- BCI (road criticality to traffic flow)
- Recurrence / persistence
- Why it is STRUCTURAL or RESPONSIVE

### Screen 3 — Patrol Calendar + VRP Routes
- Week-view calendar of which hotspot to patrol when
- OR-Tools-optimized truck routes per station
- PDF export of the patrol brief

**Status:** not built yet.

### Screen 4 — City Map
Folium map with cluster markers colored by ROI.

### M12 — Officer Feedback Form
After a patrol, officer taps:
- Towed
- Warned
- Couldn’t enforce
- Needs tow

This feeds `feedback.sqlite`; on the next pipeline run, clusters that were **“enforced but recurred”** get pushed toward STRUCTURAL.

**Status:** not built yet.

---

## 3. What BTP would get today

Right now the deliverable is a **data file + reports**, not a working app. If an ACP opened `scored_hotspots.parquet` in Excel, they would see a ranked list that tells them:

1. Where to send patrols during `08:00–10:00` vs `17:00–19:00` (peak window)
2. Which narrow commercial roads are most blocked (high LCLE)
3. Which high-traffic roads matter most even with fewer tickets (high BCI)
4. Which locations are chronic (STRUCTURAL → signage/barrier) vs one-off (RESPONSIVE → tow)

The missing pieces are the **toggle, map, routes, feedback form, and PDF export** — the parts an officer actually clicks.

---

## 4. Data age and live deployment

### Current data
The pipeline ran on a **Nov 2023 – Apr 2024** violation snapshot. That is ~1.5 years old in 2026.

**For a hackathon proof-of-concept:** perfectly acceptable. It proves the engine works.  
**For live production:** old data is a problem because road networks, commercial patterns, and violation behavior change.

**Pitch framing:**  
> *“We built this on historical BTP data to prove the engine. To go live, we need a daily/weekly feed from your e-challan or ASTraM camera system.”*

### How to make it live

| Requirement | Source | Feasibility |
|---|---|---|
| Fresh violation feed | BTP e-challan system or ASTraM cameras | Hard part is bureaucracy/API access, not tech |
| Fresh road graph | OSM (auto-updates monthly) | Easy — `osmnx` refetches |
| Station boundaries | BTP jurisdiction polygons | Medium — may need digitization |
| Officer feedback | Mobile app form per patrol | Easy to build, hard to enforce usage |

**Live architecture:**

```
BTP data feed (daily CSV/API)
    ↓
Scheduled pipeline (Airflow / Cron / Cloud Function)
    ↓
scored_hotspots.parquet updated nightly
    ↓
Streamlit dashboard / BTP internal system
```

**Honest caveat:** without a live data feed, the system remains a retrospective analytics tool, not a live ops tool.

---

## 5. ML vs rule-based approach

### Are we using ML?
No. The pipeline is entirely rule-based / engineered:

| Module | Technique |
|---|---|
| Clustering | DBSCAN |
| OSM enrichment | Heuristics + IRC defaults |
| LCLE | Vehicle footprint × road width formula |
| BCI | Graph betweenness centrality |
| Peak window | Hourly mode |
| ROI | Weighted multi-criteria formula |
| Classification | Threshold on recurrence |

### Why no ML is okay
1. **Explainability** — we can tell an ACP exactly why C_298 is #1.
2. **No labeled training data** — `action_taken` is all NULL; supervised ML cannot be trained.
3. **Police preference** — ACPs trust transparent scores over black boxes.
4. **Works with existing data** — BTP already has violation records.

### How to defend it to judges
> *“We use AI-driven geospatial intelligence — DBSCAN clustering, OSM road graph analysis, and betweenness centrality — to detect hotspots and measure traffic impact. Because BTP’s historical data lacks enforcement outcomes, a supervised ML model cannot be trained reliably. Instead, we built an explainable, physics-inspired scoring engine that works with the data BTP already has. ML comes in Phase 2 once officer feedback creates labeled training data.”*

### Should we add ML later?
Not for the hackathon. After the feedback loop runs for a few months, ML becomes valuable for:
- Next-week hotspot intensity forecasting
- Recurrence prediction after enforcement
- Optimal patrol time prediction
- Emerging-hotspot anomaly detection

But none of this is possible without outcome labels from M12 feedback.

---

## 6. Proposed agentic enforcement layer

Instead of forcing ML, we can build an **agentic recommendation layer** on top of the existing ROI engine. The agent does not replace the engine; it wraps it.

### The shift in value proposition
From:
> *“Here is a ranked list of hotspots.”*

To:
> *“Today at 5 PM, send Truck-3 to HSR Layout Junction because it is the highest-ROI hotspot in that jurisdiction, and here is the reason + expected impact.”*

### What the agent layer adds
1. Scheduling / triggering
2. Jurisdiction-aware routing
3. Action recommendation
4. Feedback / reason capture
5. Memory of past decisions

---

## 7. Phase A — Build now (for hackathon demo)

### A1. Daily Patrol Agent script
A single Python script (`pipeline/agent_daily_brief.py`) that:
- Loads `scored_hotspots.parquet`
- Filters by current day + peak window matching the current/next 2-hour slot
- Groups by `assigned_station`
- Picks top-N hotspots per station by ROI
- Outputs a patrol brief per station/truck

**Output:** `data/outputs/daily_patrol_briefs.json` + `reports/DAILY_PATROL_BRIEF.md`

### A2. Notification-style report generator
Generates a human-readable brief, e.g.:

```
Station: HSR Layout
Time window: 17:00–19:00
Truck 1 route: C_298 → C_149 → C_104
Reason: High LCLE (lane blockage) + high BCI (critical road) + recurring weekday peak
Expected impact: Clear 3 high-traffic chokepoints
```

This mimics what an agent would send to a tow-truck driver or ACP.

### A3. Feedback + reason capture schema
Extend M12 with structured reason codes:
- No parking space nearby
- Customer waiting
- Loading/unloading
- Broken-down vehicle
- Ignored sign

Store in `feedback.sqlite`:
- `cluster_id`
- `timestamp`
- `enforcement_action`
- `outcome`
- `reason_code`
- `reason_text`
- `officer_id`

### A4. Simple memory lookup
When the agent recommends a hotspot, check past feedback:
- *“This location was enforced 3 times last month but recurred → escalate to STRUCTURAL.”*
- *“Reason ‘No parking space’ keeps appearing → recommend signage/BBMP.”*

---

## 8. Phase B — Build after hackathon / for live deployment

### B1. Live data pipeline
- API/webhook from BTP e-challan system
- Airflow / cron job every 2 hours
- Incremental clustering + rescoring
- Cache OSM graph and BCI to avoid recomputation

### B2. Real notification delivery
- SMS / WhatsApp to tow-truck drivers
- Dashboard alert to ACP
- Mobile app push notification

### B3. Multi-agent orchestration (only if justified)
- **Scoring Agent:** updates ROI
- **Routing Agent:** assigns trucks using VRP
- **Notification Agent:** sends alerts
- **Feedback Agent:** reclassifies based on recurrence

---

## 9. Do’s and Don’ts

### ❌ Don’t do these

| Don’t | Why |
|---|---|
| Claim “real-time” with only 2023–2024 data | Say “designed for live data” or “nightly batch on historical data.” Lying kills credibility. |
| Build complex LangChain/CrewAI multi-agent framework | Overkill for a hackathon. A single scheduled script + report is enough. |
| Collect citizen PII or reasons without legal framework | Challan reasons are sensitive. Keep officer-only or mention “with BTP consent.” |
| Promise fully autonomous enforcement decisions | Always keep a human (ACP/officer) in the loop. The agent recommends; the officer approves. |
| Add ML just to call it AI | You already decided no ML. Stick to it. |
| Bloat the demo with too many screens | Show: priority board → daily brief → feedback. That is enough. |
| Build a separate AI model for “smart decisions” | Your existing ROI formula is the intelligence. Don’t duplicate it. |

### ✅ Do these

| Do | Why |
|---|---|
| Call it an “Agentic Enforcement Recommendation Engine” | Accurate. It recommends, not decides. |
| Show one concrete daily brief per station | Officers understand “go here at 5 PM” immediately. |
| Include jurisdiction-aware routing | You already have `assigned_station`. Use it. |
| Capture structured reason codes | They become ML training data later. |
| Demonstrate memory: “enforced but recurred” → STRUCTURAL | This is the feedback loop closing. Very powerful. |
| Pitch the live architecture | Show the end-to-end data flow diagram. |
| Keep the existing ROI engine as the brain | Everything else wraps around what you already built. |

---

## 10. Suggested new files to add

To implement the agentic layer for demo:

1. `pipeline/agent_daily_brief.py` — generates station-wise patrol briefs
2. `app/screens/daily_brief.py` — Streamlit screen showing today’s brief
3. `app/officer/feedback_form.py` — officer feedback + reason capture
4. `reports/DAILY_PATROL_BRIEF.md` — sample daily brief report
5. `docs/LIVE_ARCHITECTURE.md` — architecture diagram for live deployment

---

## 11. One-sentence pitch

> *“Our AI-driven agent doesn’t just rank hotspots — it generates jurisdiction-aware patrol briefs, sends them to the right officer at the right time, and learns from enforcement outcomes and citizen reasons to keep improving.”*

---

## 12. Bottom line

- The backend is done and produces a ranked, actionable hotspot list.
- The officer-facing dashboard, routes, and feedback loop are missing.
- ML is optional; the rule-based engine is explainable and deployable today.
- An agentic recommendation layer is the best next step — lightweight, grounded in existing ROI scoring, and demo-friendly.
- Keep the human in the loop. Don’t over-engineer. Don’t fake real-time or ML.
