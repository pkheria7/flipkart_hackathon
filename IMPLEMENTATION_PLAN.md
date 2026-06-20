# Implementation Plan — Parking Enforcement Intelligence Engine
### Flipkart Gridlock 2.0 — Round 2 — Theme 1
#### Phase-wise build guide: what to do, in what order, how to build it, and what each step needs

> **How to read this:** Phases are sequential. Within a phase, [A] = Person A (Brain/pipeline), [B] = Person B (Face/product), [BOTH] = together. Each task lists: what it produces, what it needs, how to build it, and the done-check. Don't move to the next phase until the "Gate" passes.

---

## Quick Map

```
PHASE 0  Setup & Foundation        [BOTH]   — repo, env, clean data, data contract
PHASE 1  Parallel Core Build       [A]+[B]  — A: pipeline to ROI | B: dashboard on mock
PHASE 2  First Integration         [BOTH]   — real scored data into real dashboard
PHASE 3  System Depth              [A]+[B]  — A: BCI + classifier + validation | B: jurisdiction + screens
PHASE 4  The Loop & Routing        [A]+[B]  — A: support | B: VRP + feedback + infra intel
PHASE 5  Demo Hardening            [BOTH]   — rehearse toggle, live loop, deck, Q&A
```

**Golden rule:** Person B builds against a MOCK data file from hour one and never waits for Person A. Person A delivers REAL data as early as possible (Phase 2), even if minimal.

---

## PHASE 0 — Setup & Foundation  [BOTH, do together]

Goal: shared repo, working environment, clean dataset, and a locked data contract. Nothing splits until this is done.

### 0.1 [BOTH] Create the repo and structure
**Produces:** project skeleton.
**Needs:** GitHub.
**How:**
```bash
mkdir parking-enforcement-intelligence-engine && cd $_
git init
mkdir -p data/raw data/processed data/outputs pipeline app/screens app/officer app/utils references notebooks
touch requirements.txt README.md
```
Put the Theme 1 dataset in `data/raw/theme1_dataset.csv`.
**Done-check:** folder tree matches the README file structure.

### 0.2 [BOTH] Set up the Python environment
**Produces:** working venv with all libraries.
**Needs:** Python 3.11.
**How:**
```bash
python3.11 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install pandas numpy h3 scikit-learn osmnx geopandas shapely networkx ortools folium plotly streamlit flask reportlab pyarrow
pip freeze > requirements.txt
```
> **WARNING:** geopandas + osmnx are the install-pain points. If pip fails, use conda for these two: `conda install -c conda-forge geopandas osmnx`. Solve this NOW, not in Phase 1.
**Done-check:** `python -c "import osmnx, geopandas, networkx, h3, ortools; print('ok')"` prints ok.

### 0.3 [BOTH] Build P1 — the cleaning pipeline (pair-program this)
**Produces:** `data/processed/cleaned_violations.parquet`.
**Needs:** raw CSV, pandas.
**How — `pipeline/01_clean.py`:**
1. Load CSV.
2. Parse `violation_type` and `offence_code` JSON arrays with `ast.literal_eval` (wrap in try/except — some rows malformed).
3. Convert `created_datetime`: `pd.to_datetime(df.created_datetime).dt.tz_localize('UTC').dt.tz_convert('Asia/Kolkata')`.
4. Resolve vehicle type: `df['veh'] = df.updated_vehicle_type.fillna(df.vehicle_type)`.
5. Drop bad coords: keep only `12.8 < lat < 13.2` and `77.4 < lng < 77.8`.
6. Feature-engineer: `hour`, `day_of_week`, `week_number`, `is_peak_hour` (hour in 8,9,17,18,19), `time_period`, `junction_flag` (= "PARKING NEAR ROAD CROSSING" in violation_type list).
7. Save: `df.to_parquet('data/processed/cleaned_violations.parquet')`.
**Done-check:** print `df.shape`, `df.veh.value_counts()`, `df.hour.value_counts().sort_index()`. Numbers look sane (peak hours have more violations; vehicle types are real categories).

### 0.4 [BOTH] LOCK the data contract (the most important 15 minutes)
**Produces:** `references/scored_hotspots_schema.md` — the interface between A and B.
**How:** write down the exact columns of the final scored table both halves agree on:
```
cluster_id        str
centroid_lat      float
centroid_lng      float
assigned_station  str
border_flag       int (0/1)
road_class        str
road_width_m      float
osm_coverage      int (1=real OSM, 0=IRC default)
violation_count   int
vehicle_mix       str (e.g. "BUS:3,CAR:12,SCOOTER:40")
lcle_pct          float (0-100)
bci               float (0-1)
persistence       float
recurrence        float (0-1)
peak_window       str (e.g. "Mon-Fri 08:00-10:00")
roi_score         float (0-100)
classification    str (STRUCTURAL / RESPONSIVE)
recommended_action str (TOW / WARNING / BARRIER)
```
**Done-check:** both A and B have this file. This is the law. Neither changes it without telling the other.

### 0.5 [B] Make the MOCK data file (so B can start immediately)
**Produces:** `data/outputs/scored_hotspots_MOCK.csv` — 12 fake rows with the exact contract columns, using real Bengaluru names (Koramangala 5th Block, Shivajinagar Metro Feeder, HSR 27th Main, Indiranagar 100ft Rd, etc.).
**How:** hand-type 12 rows in a spreadsheet, vary the numbers so ROI ranking ≠ count ranking (give one low-count/high-ROI row to prove the toggle).
**Done-check:** B can load this file and it has every contract column.

### GATE 0 ✅
- Repo exists, env works, `import osmnx` succeeds.
- `cleaned_violations.parquet` exists with sane numbers.
- Data contract written and agreed.
- Mock file exists.
**→ Now split. A and B work in parallel.**

---

## PHASE 1 — Parallel Core Build

Goal: A builds the pipeline up to a real ROI ranking. B builds the dashboard with the toggle on mock data. They do NOT block each other.

---

### PERSON A — Pipeline to ROI

#### 1A.1 Build P2 — Clustering
**Produces:** `data/processed/clustered_violations.parquet`.
**Needs:** cleaned parquet, h3, scikit-learn.
**How — `pipeline/02_cluster.py`:**
1. H3 index each row: `df['h3'] = df.apply(lambda r: h3.geo_to_h3(r.lat, r.lng, 9), axis=1)`.
2. DBSCAN for organic clusters: convert lat/lng to radians, `DBSCAN(eps=150/6371000, min_samples=15, metric='haversine')`.
3. Group into clusters: for each cluster compute centroid (mean lat/lng), violation_count, vehicle_mix string, police_station mode.
4. Save.
**Done-check:** plot cluster centroids on a folium map. Do they land on real roads in commercial areas? If everything is one giant blob, lower eps. If everything is noise, raise eps or lower min_samples.

#### 1A.2 Build P4 — OSM Enrichment (the hard one — start early)
**Produces:** `data/processed/enriched_clusters.parquet` + saved road graph.
**Needs:** osmnx, geopandas, networkx. INTERNET (one-time).
**How — `pipeline/04_enrich_osm.py`:**
1. One-time download + SAVE so you never refetch:
   ```python
   import osmnx as ox
   G = ox.graph_from_place("Bengaluru, India", network_type="drive")
   ox.save_graphml(G, "references/bengaluru_drive.graphml")
   ```
2. For each cluster centroid, snap to nearest edge: `ox.distance.nearest_edges(G, lng, lat)`. Get that edge's `highway` class and `width` tag.
3. Where `width` missing, apply IRC default lookup (primary 7.0, secondary 5.5, tertiary 4.0, residential 3.5).
4. Record `osm_coverage` flag.
5. Save enriched clusters.
> **PIN THE VERSION:** if using an AI agent, tell it "osmnx 1.6+ API — use `ox.distance.nearest_edges` and `ox.graph_from_place`." Older API names will break.
> **PERFORMANCE:** snapping thousands of points is fine. Do NOT compute BCI yet (that's Phase 3) — it's the slow part.
**Done-check:** print `% of clusters with real OSM width vs IRC default`. Expect 50-70% real. If near 0%, your snapping is broken.

#### 1A.3 Build M2 — LCLE
**Produces:** `lcle_pct` column.
**Needs:** enriched clusters (road width), vehicle mix.
**How — in `pipeline/05_score.py`:**
```python
VEHICLE_FOOTPRINT = {'TANKER':2.6,'BUS':2.5,'MAXI-CAB':2.1,'CAR':1.8,
                     'PASSENGER AUTO':1.5,'AUTO':1.5,'SCOOTER':0.7,'BIKE':0.7}
# representative concurrent blockage — use a capped sum of the dominant vehicles
raw_block = weighted sum of footprints in cluster
obstruction = 1.5 if junction_flag else 1.0
lcle_pct = min(100, (raw_block / road_width_m) * obstruction * 100)
```
**Done-check:** sort clusters by lcle_pct. Do narrow-road + big-vehicle clusters top the list? A bus on a 3.5m road should be high; scooters on a 9m road low. If everything is 100%, your raw_block sum is too aggressive — use representative concurrent vehicles, not all-time total.

#### 1A.4 Build M3 — Peak Window
**Produces:** `peak_window`, `persistence` columns.
**Needs:** cleaned data timestamps (no OSM needed — can build anytime).
**How:**
1. For each cluster, pivot violations by hour × day_of_week.
2. Rolling 2-hour sum; argmax = peak window.
3. persistence = mean violations/hour inside that window.
**Done-check:** peak windows cluster around 8-10am and 5-8pm for commercial areas. Sane.

#### 1A.5 Build M1 — ROI Ranker (THE CORE — stub BCI=1.0 for now)
**Produces:** `data/outputs/scored_hotspots.parquet` — the REAL deliverable B is waiting for.
**Needs:** M2 (lcle), M3 (persistence). BCI stubbed = 1.0. road_traffic_weight from OSM class.
**How:**
```python
TRAFFIC_WEIGHT = {'primary':1.0,'secondary':0.7,'tertiary':0.5,
                  'residential':0.3,'service':0.15,'unclassified':0.2}
officer_hours = {'TOW':2.0,'WARNING':0.5,'BARRIER':3.0}  # default TOW=2.0 for now
roi = (lcle_pct * traffic_weight * persistence * bci) / officer_hours
# normalize roi to 0-100
```
Write the parquet with ALL contract columns (classification can be placeholder "RESPONSIVE" for now).
**Done-check (CRITICAL):** sort by roi vs sort by violation_count. Are they DIFFERENT lists? If identical, ROI adds nothing — debug. The whole project rests on these two lists diverging.

---

### PERSON B — Dashboard on Mock Data (parallel, never blocked)

#### 1B.1 Streamlit skeleton
**Produces:** `app/main.py` that runs and shows nav.
**Needs:** streamlit, the MOCK csv.
**How:** `streamlit run app/main.py`. Sidebar nav for 4 screens. Load `scored_hotspots_MOCK.csv` into a dataframe at top.
**Done-check:** app opens in browser, mock data loads.

#### 1B.2 Screen 1 — Priority Board + THE TOGGLE (your single most important deliverable)
**Produces:** `app/screens/priority_board.py`.
**Needs:** mock data.
**How:**
1. Show the hotspots as a table: location, ROI, LCLE%, peak window, action.
2. Add a radio/toggle: "Sort by: [ROI] [Violation Count]".
3. On toggle, re-sort the dataframe and re-render. Make the reorder VISIBLE — color the rows, animate if you can.
4. Add a station dropdown (this becomes jurisdiction scoping later — for now just filters mock rows).
**Done-check:** flipping the toggle visibly reorders the list. This IS the demo. Make it crisp.

#### 1B.3 Screen 2 — Junction Detail
**Produces:** `app/screens/junction_detail.py`.
**How:** click a row → show full breakdown: vehicle mix, road width, LCLE%, BCI, recurrence, classification tag (STRUCTURAL red / RESPONSIVE green), recommended action. Add an hour×day heatmap (plotly) from mock or simple synthetic data.
**Done-check:** every score on the card is shown and labeled. Looks explainable.

#### 1B.4 Screen 3 + 4 skeleton
**Produces:** `patrol_calendar.py`, `city_map.py` (rough).
**How:** Screen 3 — a 7-day × 4-slot grid, fill with mock assignments + a "Download PDF" button (wire reportlab later). Screen 4 — folium map with mock cluster markers colored by ROI.
**Done-check:** both render without error.

### GATE 1 ✅
- [A] `scored_hotspots.parquet` exists, REAL, with ROI ≠ count.
- [B] Dashboard runs, toggle works on mock data, 4 screens render.
**→ Integrate.**

---

## PHASE 2 — First Integration  [BOTH]

Goal: swap B's mock file for A's real file. Debug the seam. Get real numbers on screen.

### 2.1 [BOTH] Swap mock → real
**How:** B changes the data load from `scored_hotspots_MOCK.csv` to `scored_hotspots.parquet`.
**Done-check:** dashboard renders A's real clusters.

### 2.2 [BOTH] Fix the seam
**Common breaks:** column name mismatches, parquet vs csv read, dtype issues (station as object, roi as float), NaN in a column B assumed full.
**How:** go column by column against the contract. Fix whichever side drifted from the schema.
**Done-check:** all 4 screens work on REAL data. The toggle reorders REAL hotspots.

### 2.3 [BOTH] Sanity review the real output together
**How:** look at the top 10 real ROI hotspots. Do the locations make sense (commercial, metro, market areas)? Does the #1 differ from #1-by-count? Is anything obviously broken (all LCLE = 100%, all same peak window)?
**Done-check:** you both believe the numbers. If not, A debugs the offending module.

### GATE 2 ✅ — **You now have a working, demoable product on real data.** Everything after this is depth.

---

## PHASE 3 — System Depth

Goal: A adds BCI, finalizes the classifier, builds validation. B builds real jurisdiction scoping and polishes screens.

---

### PERSON A

#### 3A.1 Build M7 — BCI (the slow one)
**Produces:** real `bci` column (replaces the 1.0 stub).
**Needs:** saved road graph (from 1A.2), networkx.
**How:**
1. Load saved graph: `G = ox.load_graphml("references/bengaluru_drive.graphml")`.
2. Compute APPROXIMATE betweenness (full exact will hang): `nx.betweenness_centrality(nx.DiGraph(G), k=500, seed=42)` — k-sampling.
3. Map each cluster's snapped edge to its betweenness value.
4. Approximate alternative routes (count near-parallel edges in a buffer, or use a simpler proxy).
5. `bci = betweenness_norm * (1/(alt_routes+1))`, normalize 0-1.
6. Re-run M1 with real BCI.
> **If BCI hangs or is too slow:** reduce k, or compute on a consolidated/simplified graph (`ox.simplify_graph`). It's better to ship approximate BCI than none.
**Done-check:** find a low-count cluster on a sole-feeder road — does its ROI jump with real BCI? That's the demo beat.

#### 3A.2 Build M4 — Structural vs Responsive Classifier
**Produces:** real `classification`, `recommended_action`.
**Needs:** weekly violation bins per cluster.
**How:**
1. recurrence_rate = weeks_above_threshold / total_weeks.
2. STRUCTURAL if recurrence > 0.75 (and later, if M15 corroborates). Else RESPONSIVE.
3. Set recommended_action accordingly (STRUCTURAL→BARRIER, RESPONSIVE→TOW/WARNING).
> **Honesty note:** you have NO action_taken history (all NULL). So historical classification = recurrence-only. State this. The enforcement-response signal comes alive only via M12 feedback later.
**Done-check:** some clusters tagged STRUCTURAL, some RESPONSIVE. Spot-check a chronic location is STRUCTURAL.

#### 3A.3 Build validation (`07_validate.py`) — your scientific credibility
**Produces:** metrics for the deck.
**How:**
- Hotspot stability: top-20 in first 70% vs last 30% → overlap %.
- Precision@K: temporal split, predict top-K, compare.
- ROI-vs-count divergence: Spearman correlation (want ~0.4-0.6).
- OSM coverage rate.
- (If you have the 154 list) overlap with BTP hotspots.
**Done-check:** you have 4-5 real numbers to show judges.

---

### PERSON B

#### 3B.1 Build M18 — real Jurisdiction Scoping
**Produces:** working station-scoped views.
**Needs:** station polygons (GeoJSON) OR approximate from data.
**How — `pipeline/03_jurisdiction.py` (B owns the app-side filter; can pair with A on the polygon step):**
1. Get Bengaluru police station polygons. If unavailable: approximate each station's area as the convex hull of its `police_station`-tagged violation GPS.
2. `geopandas.sjoin()` cluster centroids into polygons → assigned_station.
3. 200m border buffer → border_flag.
4. In the dashboard: the station dropdown now filters by REAL assigned_station. ACP view = one station. Add a "JCP view" = all stations.
**Done-check:** selecting "HSR Layout" shows only HSR hotspots. Switching stations changes the list.

#### 3B.2 Polish all 4 screens on real data
**How:** real heatmaps in Screen 2, real calendar assignments in Screen 3, real colored map in Screen 4. Wire the reportlab PDF export in Screen 3.
**Done-check:** PDF downloads with a real per-station patrol brief.

### GATE 3 ✅
- Real BCI in ROI. Real classifier. Validation metrics exist.
- Jurisdiction scoping works. All screens polished on real data.
**→ Build the loop and routing.**

---

## PHASE 4 — The Loop & Routing

Goal: B builds VRP + the feedback loop. A supports and keeps the pipeline re-runnable with feedback merged in.

---

### PERSON B

#### 4B.1 Build M10 — VRP Optimizer
**Produces:** `data/outputs/patrol_routes.json` + route display.
**Needs:** ROI hotspots per station (M1+M18), road graph (travel times), OR-Tools.
**How — `pipeline/06_optimize_vrp.py`:**
1. Take top-N ROI clusters for ONE station + the depot.
2. Build travel-time matrix between them (shortest path on saved graph).
3. OR-Tools routing: K vehicles (trucks), each route ≤ time budget, MAXIMIZE collected ROI (Team Orienteering — you can skip nodes). Hard constraint: all nodes same station.
4. Output ordered stops per truck with ETAs.
> **WATCH OUT:** the agent may give a standard "visit-all" VRP. You want maximize-reward-with-skipping. Verify it actually skips low-value far nodes.
> **MOCKABLE:** if OR-Tools fights you, hardcode one sensible route for the demo. The concept still lands.
**Done-check:** output shows e.g. "Truck 1: depot→H1→H4→H7→depot" and skips the unreachable ones.

#### 4B.2 Build M12 — Officer Feedback Loop (SQLite)
**Produces:** `data/outputs/feedback.sqlite` + a feedback form.
**How — `app/officer/feedback_form.py`:**
1. Tiny form per dispatched location: Done(tow)/Done(warning)/Couldn't/Needs-tow.
2. Write to SQLite with timestamp, location_id, officer_id.
3. Dashboard reads feedback back and shows status.
**Done-check:** submit feedback → it persists → board reflects it after refresh. THIS is your live-loop demo beat.

#### 4B.3 Build M15 — Infra Intel + BBMP escalation PDF
**Produces:** site-assessment form + escalation PDF.
**How:** form (road/footpath/signage/lighting/suggested-fix) → SQLite → reportlab PDF for STRUCTURAL locations.
**Done-check:** assessment submits; escalation PDF generates.

### PERSON A (support)
#### 4A.1 Make the pipeline feedback-aware
**How:** `05_score.py` reads feedback.sqlite; if a cluster has feedback "enforced but recurred," push M4 toward STRUCTURAL. Re-run shows the change.
**Done-check:** submitting feedback then re-running flips a classification — proving the loop closes.

### GATE 4 ✅
- VRP produces routes (real or mocked). Feedback persists and updates the board. Infra escalation works. The loop visibly closes on re-run.

---

## PHASE 5 — Demo Hardening  [BOTH]

Goal: nothing breaks on stage. The story is tight.

### 5.1 [BOTH] Rehearse the toggle moment
The single most important 60 seconds. Run it 10 times. It must be instant and obvious. Pre-select the station that best shows ROI ≠ count.

### 5.2 [BOTH] Rehearse the live loop beat
Submit feedback live → refresh → classification changes. Practice the exact click sequence. Have a backup (pre-recorded gif) if SQLite hiccups.

### 5.3 [BOTH] Build the 5-slide deck
1. Problem (ACP with 4 trucks, picks by habit).
2. Insight (ASTraM sees effect, we find cause; rank by ROI not count).
3. Live demo (toggle → detail → BCI → structural → loop).
4. Validation numbers + Honest Claims (HCM citation, what we don't claim).
5. Roadmap + close (154 hotspots line).

### 5.4 [BOTH] Drill the Q&A playbook
Each take half the questions from README section 18. Answer out loud until smooth. Especially: "how do you prove causation," "you said you connected congestion data," "how does the loop learn with no action history."

### 5.5 [BOTH] Freeze and back up
Tag a working git commit. Export a screen-recording of the full happy-path demo as insurance. Have the dataset, saved graph, and parquet files on every laptop.

### GATE 5 ✅ — Demo runs end to end, twice, with no panic. Ship it.

---

## The Two Things That Most Determine Success

1. **Person B never waits.** Mock file from hour one. If B is blocked on A, the split has failed — fix the contract, not the schedule.
2. **Person A delivers real data EARLY (Gate 2), even if minimal.** Real LCLE + real ROI with stubbed BCI beats a perfect pipeline delivered too late. Integrate early, improve continuously.

## Build-with-AI-agent reminders (Cursor/Claude Code)
- Feed it ONE module's README section at a time, plus the data contract.
- Always PIN library versions for geospatial (osmnx 1.6+ API).
- After every module: YOU run it and inspect real output numbers. The agent writes code that runs; only you can tell if it's CORRECT for Bengaluru's data.
- Let the agent fly on Person B's screens/forms. Keep hands on the wheel for P4, M7, M10.

---

## One-Page Order of Operations (print this)

```
PHASE 0  [BOTH]  repo, env, P1 clean, DATA CONTRACT, mock file
PHASE 1  [A] P2→P4→M2→M3→M1(stub BCI)   [B] dashboard+TOGGLE on mock
PHASE 2  [BOTH]  swap mock→real, fix seam, sanity-check  ← demoable product
PHASE 3  [A] M7 BCI, M4 classifier, validation   [B] real jurisdiction, polish screens
PHASE 4  [B] M10 VRP, M12 feedback, M15 intel   [A] feedback-aware re-run
PHASE 5  [BOTH]  rehearse toggle + live loop, deck, Q&A, backup
```
