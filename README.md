# Parking Enforcement Intelligence Engine
### Flipkart Gridlock Hackathon 2.0 — Round 2 — Theme 1

> **"BTP has two datasets — congestion data and violation data. Both exist. Neither talks to the other. We connected them."**

---

## 0. The Core Insight (Read This First)

Bengaluru Traffic Police has two completely separate systems:

| System | What it does | What it misses |
|---|---|---|
| **ASTraM** | Monitors congestion zone-wise every 15 min | Doesn't know *why* zones are congested |
| **FTVR** (violation dataset) | Logs 2.95L parking violations with GPS | Never used for enforcement planning |

Nobody connected these two. We do.

**ASTraM tells BTP that Zone 2 is SEVERE.**
**We tell BTP it's because 3 buses are parked on a 3.5m road near Shivajinagar metro since 8 AM — and that sending one tow vehicle there between 08:00–10:00 restores 71% of that lane's capacity.**

That connection — **violation records → congestion impact → ranked enforcement action** — does not exist anywhere in BTP's current toolset. This is what we build.

---

## 1. Problem Statement

### Official Theme
**Poor Visibility on Parking-Induced Congestion** — Theme 1, Flipkart Gridlock Hackathon 2.0

### The Operational Reality

On-street illegal parking near commercial zones, metro stations, junctions, and main roads physically reduces carriageway width. A 6m road becomes 3m. A 4-lane road becomes 2-lane. This creates congestion that cascades backward for hundreds of metres — daily, repeatedly, at predictable times.

### Why It Stays Broken Today

**Problem 1 — Enforcement is blind:**
BTP has ~2,000 officers for a city of 14 million. An ACP at a sub-division has 4–6 tow vehicles every morning and picks deployment spots from experience and WhatsApp messages. No ranked list. No data. No logic.

**Problem 2 — The data is never used:**
2.95 lakh violation records exist with precise GPS coordinates, vehicle types, timestamps, and police station tags. This data was collected purely for challan generation and SCITA compliance. Nobody has ever analysed it as a spatial enforcement intelligence resource.

**Problem 3 — The two datasets are siloed:**
ASTraM sees congestion effects. FTVR records violation causes. Neither system talks to the other. The link between a parking violation cluster and the congestion it causes has never been computed.

**Problem 4 — No enforcement prioritisation exists:**
BTP's JCP manually submitted a proposal identifying 154 problem hotspots — a list built from years of officer experience. There is no data-driven system that ranks these hotspots by congestion impact, updates them dynamically, or tells officers when to deploy for maximum effectiveness.

### What the Hackathon Asks

> *"How can AI-driven parking intelligence detect illegal parking hotspots and quantify their impact on traffic flow to enable targeted enforcement?"*

Three specific gaps called out:
- Enforcement is patrol-based and reactive
- No heatmap of parking violations vs. congestion impact
- Difficult to prioritise enforcement zones

---

## 2. Proposed Solution

### What We Build

A **patrol deployment prioritisation system** — not a dashboard, not a heatmap, not an analytics report.

**The single output:** A ranked list of 10–15 locations telling a BTP ACP exactly where to send tow vehicles in the next 3 hours, in what order, at what time window, with an explanation of why — and a classification of which locations need enforcement vs. which need infrastructure.

### What Makes This Different From Every Other Team

Most teams will build:
- Heatmap of violation density ← 200+ teams will do this
- Bar charts by police station ← 180+ teams
- Top-10 junctions by violation count ← 100+ teams

We do none of that as primary output.

**We rank by Enforcement ROI — not violation count.**

A location with 40 buses on a 3.5m road near a metro junction outranks a location with 340 scooters on a 9m arterial. Same enforcement resource. Completely different congestion relief. This reframing is the product.

---

## 3. Novelty Hooks (What No Other Team Will Build)

### Hook 1 — Enforcement ROI as the primary ranking metric
Nobody frames parking enforcement as a resource allocation problem with an ROI. Every other team ranks by violation count. We rank by **(estimated lane capacity restored) ÷ (officer-hours required)**. The live demo moment: switch from "sort by violations" to "sort by ROI" — the list visibly reorders. A location with 1/5th the violations jumps to #1. That single moment proves the product's value.

### Hook 2 — Structural vs. Enforcement-Responsive Classification
We classify every hotspot into one of two categories:
- **Enforcement-Responsive:** Violations drop after tow dispatch. Keep sending tow vans.
- **Structural Problem:** Violations recur within a week despite repeated enforcement. Stop wasting tow vans. Escalate to infrastructure (bollards, signage, permanent marshal).

This is a policy insight, not just analytics. No other team will tell BTP "this junction doesn't need more enforcement, it needs bollards." We do.

### Hook 3 — Connecting the two siloed datasets
The violation dataset (FTVR) and ASTraM's congestion layer have never been connected. We use violation GPS coordinates + OSM road geometry to build the bridge: *this violation cluster is causing this much lane capacity loss on this road during this time window.* This is the missing link BTP itself couldn't build.

### Hook 4 — The "PARKING NEAR ROAD CROSSING" tag is already in the data
The violation_type field contains `"PARKING NEAR ROAD CROSSING"` as a value — meaning BTP officers already flag junction-proximate violations at logging time. We use this as a direct junction proximity signal, no OSM join needed for these rows. This is a dataset-native insight no team will discover without actually reading the data.

---

## 4. Modules / Features / Components

### Module 1 — Enforcement ROI Ranker ⭐ PRIMARY OUTPUT
**What it is:** The core engine. Ranks every violation cluster by congestion relief per officer-hour.

**Formula:**
```
ROI = (LCLE% × road_traffic_weight × persistence_score) / officer_hours_required
```

**What each term means:**
- `LCLE%` — estimated % of lane capacity blocked (see Module 2)
- `road_traffic_weight` — how busy is this road? (from OSM road class)
- `persistence_score` — how many hours per day does this cluster have violations?
- `officer_hours_required` — tow dispatch = 2 hrs, warning = 0.5 hrs, barrier = 3 hrs

**Output:** Ranked table of 10–15 locations with ROI score, recommended action, and deployment window.

**Why it's novel:** Every other team ranks by raw violation count. We rank by impact per enforcement unit. These produce different lists — showing that difference is the demo.

---

### Module 2 — Lane Capacity Loss Estimator (LCLE) ⭐ CORE ENGINE
**What it is:** A geometric model that converts violation records into estimated % of road capacity blocked.

**How it works:**
1. Snap violation GPS coordinates to nearest OSM road segment
2. Get road width (from OSM `width` tag, or IRC standard defaults by road class)
3. Get vehicle footprint from vehicle_type (Tanker=2.6m, Bus=2.5m, Car=1.8m, Auto=1.5m, Scooter=0.7m)
4. Compute: `capacity_loss% = (vehicle_footprint / road_width) × obstruction_factor`
5. Obstruction factor: 1.0 mid-block, 1.5 near-junction (forces lane-merge behaviour)
6. Aggregate per cluster: multiple vehicles sum up, capped at 100%

**Output:** Severity tier per cluster — Critical (>50%), High (30–50%), Moderate (15–30%)

**What it is NOT:** A traffic simulation. A congestion measurement. A delay estimate in minutes. It is a geometric capacity estimate — always labelled as such.

**Why it matters:** This is the bridge between "a violation exists here" and "this violation is blocking X% of this road." No other team builds this.

---

### Module 3 — Peak-Time Patrol Window Predictor ⭐ MAKES THE LIST ACTIONABLE
**What it is:** For each top hotspot, identifies the exact 2-hour window when violations peak — by day of week.

**How it works:**
1. Extract hour and day_of_week from created_datetime (convert UTC→IST first)
2. Cross-tabulate: cluster_id × hour × day_of_week → violation density pivot table
3. Find the contiguous 2-hour window with highest mean violation count per cluster
4. Separate weekday vs weekend profiles

**Output:** "Shivajinagar Metro Feeder — peak: Mon–Fri 08:00–10:00 (avg 12 violations/hr)"

**Why it matters:** Without this, the ROI ranker tells you where to go but not when. An officer arriving at 2 PM to a spot that peaks at 8 AM wastes the deployment entirely.

---

### Module 4 — Structural vs. Responsive Hotspot Classifier ⭐ THE POLICY INSIGHT
**What it is:** Classifies every hotspot as either enforcement-responsive or a structural problem requiring infrastructure.

**How it works:**
1. Bin violations by week for each spatial cluster
2. Compute recurrence rate = weeks above violation threshold / total weeks in dataset
3. Check validation_status — were actions logged at this location?
4. If recurrence_rate > 0.75 AND enforcement actions exist AND violations still recur → **STRUCTURAL**
5. If violations measurably drop after enforcement actions → **RESPONSIVE**

**Output per hotspot:**
- `STRUCTURAL` → recommend: bollards, permanent no-parking board, dedicated marshal
- `RESPONSIVE` → recommend: tow dispatch + warning drive at peak window

**Why it matters:** This is the insight that makes your product feel like operational intelligence. Telling BTP "stop wasting tow vans on this junction — it needs bollards" is a recommendation no heatmap provides. It also protects BTP from circular enforcement — the classic trap of repeatedly acting on the same location with zero long-term effect.

---

### Module 5 — Enforcement Gap Analysis (Secondary — for JCP level)
**What it is:** Station-wise accountability layer showing which police stations are logging violations but not closing them.

**How it works:**
- `closure_rate = approved cases / total logged × 100` per police_station
- `SCITA compliance = data_sent_to_scita TRUE / total × 100` per station
- Action delay = `validation_timestamp - created_datetime` distribution

**Output:** Station scorecard — log volume, closure %, SCITA compliance, month-over-month trend

**Important framing:** `action_taken_timestamp` is NULL in the full dataset — meaning we cannot confirm field deployment. We measure the **recording gap** (logging vs validation vs SCITA submission), not the **field execution gap**. State this explicitly.

**Why it's secondary:** Politically sensitive with BTP officers in the room. Show as a slide, not as a live demo screen.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  FTVR Violation DB   │    │    OpenStreetMap (offline)   │   │
│  │  Theme 1 Dataset     │    │    osmnx one-time fetch      │   │
│  │  ~2.95L rows CSV     │    │    road width, class, nodes  │   │
│  └──────────┬───────────┘    └──────────────┬───────────────┘   │
│             │                               │                    │
└─────────────┼───────────────────────────────┼────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE (Python)                       │
│                                                                  │
│  Step 1 — CLEAN                                                  │
│  · Parse violation_type JSON arrays                              │
│  · Parse offence_code JSON arrays                               │
│  · Convert created_datetime UTC → IST (+5:30)                   │
│  · Resolve vehicle_type vs updated_vehicle_type                 │
│  · Drop rows with invalid/out-of-Bengaluru coordinates          │
│  · Derive: hour, day_of_week, is_peak_hour, time_period         │
│  · Flag: junction_flag from violation_type PARKING NEAR ROAD    │
│    CROSSING (dataset-native, no OSM needed)                     │
│                                                                  │
│  Step 2 — CLUSTER                                               │
│  · H3 hex binning resolution 9 (~174m² cells) on lat/lng        │
│  · DBSCAN eps=150m min_samples=15 for hotspot detection         │
│  · Output: named clusters with centroid lat/lng                  │
│                                                                  │
│  Step 3 — ENRICH (OSM — one-time offline)                       │
│  · osmnx.nearest_edges() snap each cluster centroid to road     │
│  · Fetch: highway class, width tag                              │
│  · Where width missing → IRC standard default by class           │
│    primary=7m, secondary=5.5m, tertiary=4m, residential=3.5m   │
│  · Store as enriched_clusters.csv (no live OSM dependency)      │
│                                                                  │
│  Step 4 — SCORE                                                  │
│  · LCLE: vehicle_footprint / road_width × obstruction_factor    │
│  · Persistence: violations per hour per cluster per time period │
│  · Recurrence: weeks_above_threshold / total_weeks (0–1)        │
│  · ROI: LCLE × traffic_weight × persistence / officer_hours     │
│  · Classification: structural if recurrence>0.75 + enforcement  │
│    history exists + violations still recur                      │
│  · Peak window: argmax of hour×day pivot per cluster            │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SCORED OUTPUT LAYER                           │
│                                                                  │
│  enriched_hotspots.csv / SQLite DB                              │
│  Per cluster: roi_score, lcle_pct, peak_window, classification,  │
│  patrol_recommendation, station, violation_count, vehicle_types  │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Streamlit)                        │
│                                                                  │
│  Screen 1 — Hotspot Priority Board (PRIMARY DEMO SCREEN)        │
│  Screen 2 — Junction Detail Page                                │
│  Screen 3 — Patrol Window Calendar + PDF Export                 │
│  Screen 4 — City Map Overview (H3 hex colored by ROI)           │
│  Screen 5 — Enforcement Gap Report (screenshot only in demo)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Language | Python 3.11 | Standard, fast for data pipeline |
| Data processing | pandas, numpy | Core manipulation of 2.95L rows |
| Spatial clustering | h3-py, scikit-learn (DBSCAN) | H3 for hex binning, DBSCAN for natural cluster detection |
| OSM enrichment | osmnx, geopandas, shapely | Road snap, fetch highway class and width |
| Visualisation | folium (map), plotly (charts) | Interactive map overlays, hour×day heatmap |
| Frontend | Streamlit | Fastest path to a working multi-screen demo |
| PDF export | reportlab or weasyprint | Weekly patrol brief generation |
| Storage | SQLite / CSV | No server needed, portable for demo |
| Version control | Git + GitHub | Standard |

**No ML frameworks needed for core build.** The scoring models are weighted formulas and pivot tables — not neural networks. Don't overcomplicate this. Explainability is a feature, not a limitation.

---

## 7. How We Use the Dataset — Column by Column

| Column | How we use it | Produces |
|---|---|---|
| `latitude`, `longitude` | H3 clustering + OSM road snap | Spatial violation clusters |
| `vehicle_type` / `updated_vehicle_type` | Lane blockage footprint weight | LCLE input |
| `violation_type` (JSON array) | Parse "PARKING NEAR ROAD CROSSING" as junction flag | Junction proximity signal |
| `offence_code` (JSON array) | Severity hierarchy (104=junction, 112=wrong, 113=no parking) | Violation severity tier |
| `created_datetime` | UTC→IST, extract hour + day_of_week | Peak patrol window |
| `police_station` | Group by station for gap analysis | Station scorecard |
| `junction_name` | Direct BTP junction tag where non-null (BTP044 etc.) | Confirms junction proximity |
| `validation_status` | `approved` rate per station = closure rate | Enforcement gap metric |
| `data_sent_to_scita` | TRUE rate per station = SCITA compliance | Accountability metric |
| `closed_datetime` | All NULL — do not use for enforcement confirmation | Discard |
| `action_taken_timestamp` | All NULL — do not use | Discard |
| `description` | All NULL — do not use | Discard |
| `vehicle_number` | Anonymised — do not use for tracking | Discard |

---

## 8. External Resources Needed

| Resource | What it's for | When needed | How to get it |
|---|---|---|---|
| **OpenStreetMap via osmnx** | Road width, highway class per violation cluster | One-time offline enrichment step | `pip install osmnx` + `osmnx.graph_from_place("Bengaluru, India")` — download once, save locally |
| **IRC Road Standards** | Default road width by class when OSM tag missing | During LCLE computation | Static lookup table hardcoded — IRC:86 and IRC:SP:41 standards. No API. |
| **Bengaluru boundary polygon** | Filter out-of-city coordinates | Data cleaning step | Available in osmnx or from GeoJSON — one-time download |
| **BTP junction list** | Cross-reference junction_name codes (BTP044 etc.) | Optional enrichment | Already partially in the dataset itself — junction_name column |

**No paid APIs. No live data feeds. No real-time dependencies. Everything runs offline after the one-time OSM download.**

---

## 9. Implementation Plan

### Phase 1 — Data Pipeline (Day 1–2)
- [ ] Load full 2.95L row dataset
- [ ] Parse violation_type and offence_code JSON arrays
- [ ] Convert all timestamps UTC → IST
- [ ] Resolve vehicle_type vs updated_vehicle_type
- [ ] Flag junction_proximate violations from violation_type field
- [ ] Drop bad coordinates (outside Bengaluru bounding box)
- [ ] Derive columns: hour, day_of_week, is_peak_hour, time_period, week_number
- [ ] Run H3 hex binning (res 9) and DBSCAN clustering
- [ ] Export clean clustered dataset

### Phase 2 — OSM Enrichment (Day 2)
- [ ] Download Bengaluru road network via osmnx (one-time)
- [ ] Snap each cluster centroid to nearest OSM road edge
- [ ] Fetch highway class and width tag
- [ ] Apply IRC default widths where OSM width is missing
- [ ] Record OSM coverage rate (% of clusters with actual width tag vs defaulted)
- [ ] Export enriched_clusters.csv

### Phase 3 — Scoring Models (Day 3)
- [ ] Implement LCLE formula per cluster
- [ ] Implement persistence score (violations per hour per cluster)
- [ ] Implement recurrence score (week-over-week density)
- [ ] Implement ROI formula
- [ ] Implement structural vs responsive classification
- [ ] Implement peak window detection (hour×day pivot per cluster)
- [ ] Temporal train-test split — train on first 70%, validate on last 30%
- [ ] Compute validation metrics (see Section 10)
- [ ] Export final scored hotspot table

### Phase 4 — Frontend (Day 4–5)
- [ ] Screen 1: Hotspot Priority Board — sortable ROI table with toggle
- [ ] Screen 2: Junction Detail Page — score breakdown + hour×day heatmap + classification
- [ ] Screen 3: Patrol Window Calendar — station selector + weekly time grid + PDF export
- [ ] Screen 4: City Map — H3 hex overlay colored by ROI score
- [ ] Screen 5: Enforcement Gap Report — station scorecard table

### Phase 5 — Demo Prep (Day 6)
- [ ] Load real Bengaluru junction names into all UI labels (BTP044, Koramangala, Shivajinagar etc.)
- [ ] Rehearse the ROI rerank demo moment (3 run-throughs minimum)
- [ ] Prepare 5-slide pitch deck
- [ ] Stress-test the toggle between sort modes on Screen 1
- [ ] Prepare honest metric summary (precision@K, hotspot stability, OSM coverage rate)

---

## 10. Validation Metrics (Honest — Only What the Dataset Supports)

| Metric | How to compute | What it proves |
|---|---|---|
| **Hotspot stability** | Top-20 clusters from first 70% of data → check how many remain in top-20 in last 30% | Ranking is real, not noise |
| **Precision@K** | Temporal split: predict top-K violation-dense clusters for test month; compare to actual top-K | Spatial model is predictive |
| **Peak window accuracy** | Predict peak 2-hr window from training data; check overlap with actual peak in test data | Temporal model is valid |
| **Station closure rate spread** | Range of validation_status=approved rates across police stations | Enforcement gap is real and measurable |
| **OSM coverage rate** | % of clusters with actual OSM width tag vs IRC default | Pipeline transparency |
| **ROI vs count rank delta** | Show Spearman rank correlation between ROI list and count list | Proves the two rankings differ — this is your core novelty proof |

**Do NOT show:**
- Accuracy % for JCRS (no ground truth to validate against)
- Congestion delay in minutes (no speed data)
- "95% precision" or similar (will be called out)

---

## 11. What We Are NOT Building (Explicitly)

| What | Why not |
|---|---|
| General violation heatmap as primary screen | 200+ teams will build this — it proves nothing novel |
| Violations by police station bar charts as primary | Basic GROUP BY — not intelligence |
| Real-time data pipeline | Dataset is historical — no live FTVR feed available |
| Congestion delay prediction in minutes | No speed/probe data in dataset — would be fabricated |
| Individual vehicle repeat offender tracking | Vehicle numbers are anonymised |
| Event-based congestion module | That's Theme 2 — out of scope |
| Anything that replicates ASTraM's existing congestion heatmap | They already have it — we fill the gap, not the overlap |

---

## 12. Demo Story (4 Minutes)

**0:00–0:40 — The problem as a human situation**
"It's 6:45 AM. An ACP at HSR Layout has 4 tow vehicles and 15 officers. He has 847 open violation records on a spreadsheet. He picks the same 5 spots he always does — because that's what he knows. We give him something better."

**0:40–1:30 — Show Screen 1, not the map**
Open on the Hotspot Priority Board. ROI-ranked list for the next 3 hours. #1 is not Koramangala 5th Block — despite having the most violations. "We don't rank by violations. We rank by how much road you get back per officer-hour."

**1:30–2:15 — THE MOMENT**
Toggle to "Sort by violation count." Koramangala 5th Block jumps to #1 with 340 violations. Toggle back to "Sort by ROI." It drops to #4. A location near Shivajinagar metro with 67 violations is now #1. Explain why: 3 buses, 3.5m road, 71% lane capacity blocked, 08:00 peak window. "Same resource. Different decision. 3× more road recovered."

**2:15–3:00 — Screen 2: The classification**
Click #1 location. Show it's classified STRUCTURAL. "Enforced 3 times in 60 days. Violations back within a week each time. Our system says: stop sending tow vans. This needs bollards."

**3:00–3:45 — Screen 3: The output**
Weekly patrol calendar for HSR Layout station. 5 hotspots, optimal time slots, tow vehicle allocation. Exportable as PDF. "This is what the ACP walks into morning briefing with. Generated from data."

**3:45–4:00 — Close**
"BTP's JCP compiled 154 problem hotspots manually and wrote a letter requesting tow vehicles. We generate that list from data, rank it by actual congestion impact, classify which ones need infrastructure instead of enforcement, and update it every week. That's the tool."

---

## 13. Positioning

**Project name:** Parking Enforcement Intelligence Engine

**One-line pitch:**
> *"We don't show where illegal parking happens. We show where clearing it first saves the most road."*

**Demo opening line:**
> *"BTP logs 10 lakh parking violations a year. ASTraM shows congestion zone-by-zone. Neither system tells an ACP where to send his tow vehicle tomorrow morning. We do."*

**What we are:** A patrol deployment prioritisation tool that ranks enforcement locations by congestion relief per officer-hour — not violation count.

**What we are not:** A dashboard. A heatmap. An analytics report. A real-time system. A congestion predictor.

**The gap we fill:** The link between BTP's violation records (cause) and ASTraM's congestion layer (effect) has never been computed. We compute it.

---

## 14. File Structure

```
parking-enforcement-intelligence-engine/
│
├── data/
│   ├── raw/
│   │   └── theme1_dataset.csv          ← original 2.95L row dataset
│   ├── processed/
│   │   ├── cleaned_violations.csv      ← after Phase 1 pipeline
│   │   ├── clustered_violations.csv    ← after H3 + DBSCAN
│   │   └── enriched_clusters.csv      ← after OSM enrichment
│   └── outputs/
│       └── scored_hotspots.csv         ← final ranked table
│
├── pipeline/
│   ├── 01_clean.py                     ← Phase 1: cleaning + feature engineering
│   ├── 02_cluster.py                   ← Phase 2: H3 + DBSCAN
│   ├── 03_enrich_osm.py               ← Phase 2: OSM road snap
│   ├── 04_score.py                    ← Phase 3: LCLE + ROI + classification
│   └── 05_validate.py                 ← Phase 3: precision@K, stability metrics
│
├── app/
│   ├── main.py                        ← Streamlit app entry point
│   ├── screens/
│   │   ├── priority_board.py          ← Screen 1
│   │   ├── junction_detail.py         ← Screen 2
│   │   ├── patrol_calendar.py         ← Screen 3
│   │   ├── city_map.py               ← Screen 4
│   │   └── gap_report.py             ← Screen 5
│   └── utils/
│       ├── scoring.py                 ← LCLE + ROI formulas
│       └── pdf_export.py             ← Patrol brief PDF generator
│
├── references/
│   └── irc_road_widths.py            ← IRC standard default widths lookup table
│
├── requirements.txt
└── README.md
```

---

## 15. Requirements

```
pandas>=2.0
numpy>=1.24
h3>=3.7
scikit-learn>=1.3
osmnx>=1.6
geopandas>=0.14
shapely>=2.0
folium>=0.15
plotly>=5.18
streamlit>=1.28
reportlab>=4.0
```

---

*All sample values used in UI (junction names, scores, violation counts) are derived from or consistent with the actual dataset. No fabricated data in the model outputs.*
