# Backend Work Split — Piyush & Prakhar
### Derived from IMPLEMENTATION_PLAN.md — backend modules only, frontend/dashboard tasks dropped

---

## How the split works

Your original plan grouped work by "Brain" (pipeline) vs "Face" (product UI). Since you're backend-only right now, that 50/50 line doesn't apply anymore — Person A's original track was ~8 backend modules and Person B's was only 4 (the rest was dashboard screens). So this is a **fresh split** of just the backend modules, rebalanced for equal load and grouped by actual code/data dependency — not by who originally owned it.

Two constraints drove the grouping:
1. **No mid-script handoffs.** `P2 → P4 → M2 → M1 → M7` all write to the same 2-3 files and depend on each other in strict sequence. Splitting this chain between two people would mean constant blocking. It stays with one person.
2. **Modules that don't need OSM data go to the other person**, so they're never sitting idle waiting on the slow OSM enrichment step.

---

## The Split

### 🔵 Piyush — Core ROI Pipeline (the spine)
*One continuous, sequential chain — clustering through to the final ROI score.*

| Module | What it produces | Depends on |
|---|---|---|
| P2 — Clustering | `clustered_violations.parquet` | cleaned data |
| P4 — OSM Enrichment | `enriched_clusters.parquet` + saved road graph | own P2 output |
| M2 — LCLE | `lcle_pct` column | own P4 output |
| M1 — ROI Ranker | `scored_hotspots.parquet` (v1, BCI stubbed) | own M2 + Prakhar's M3 persistence |
| M7 — BCI (Phase 3) | real `bci` column | own saved graph from P4 |

**Effort weight: ~11/24** (heaviest individual items: P4 and M7 are both graph-theory-heavy)

### 🟢 Prakhar — Classification, Geography & Ops Layer
*Modules that don't need OSM data, plus the operational/feedback systems.*

| Module | What it produces | Depends on |
|---|---|---|
| M3 — Peak Window | `persistence`, `peak_window` columns | Piyush's P2 output only (not OSM) |
| M18 — Jurisdiction Scoping (backend half) | `assigned_station`, `border_flag` | Piyush's P2 output only (not OSM) |
| M4 — Classifier | `classification`, `recommended_action` | weekly violation bins (not OSM) |
| M10 — VRP Optimizer | `patrol_routes.json` | own M18 + Piyush's saved graph |
| M12 — Feedback Loop (backend half) | `feedback.sqlite` schema + read/write logic | scored output's cluster_ids |
| M15 — Infra Intel (backend half) | site-assessment SQLite + PDF generation logic | M4's STRUCTURAL list |
| Validation | stability, Precision@K, Spearman, OSM coverage | final merged output |

**Effort weight: ~11/24**

> Dropped from both tracks: the actual Streamlit/form UI pieces of M12 and M18 (dashboard dropdown, feedback form HTML) — those are frontend, out of scope for now. Build the backend logic (schema + functions) only; wire a thin test script to prove it works instead of a UI.

---

## Build Order (phase by phase)

### PHASE 0 — Setup & Foundation `[BOTH]`
Same as your original §0.1–§0.4: repo, venv (watch the osmnx/geopandas install pain point), pair-program **P1 cleaning** → `cleaned_violations.parquet`, then lock the data contract together. Skip §0.5 (mock dashboard file) — not needed without a frontend track.

**Gate 0:** env works, cleaned parquet looks sane, contract locked.

---

### PHASE 1 — Build the Core Spine
**Piyush** (sequential):
1. P2 Clustering → `clustered_violations.parquet`. **Hand this off to Prakhar the moment it lands** — don't wait to start P4.
2. P4 OSM Enrichment (the slow one — download + save the graph once, snap centroids, IRC defaults).
3. M2 LCLE (needs your own P4 output).
4. M1 ROI Ranker — BCI stubbed at 1.0, pull in Prakhar's `persistence` column (should already be ready) → `scored_hotspots.parquet` v1.

**Prakhar** (starts as soon as `clustered_violations.parquet` exists — never waits on OSM):
1. M3 Peak Window → hand `persistence`/`peak_window` back to Piyush as soon as done (Piyush needs it for M1).
2. M18 Jurisdiction Scoping (sjoin / convex-hull approximation, border buffer).
3. M4 Classifier (recurrence-only, since `action_taken` is all NULL right now — same honesty caveat as the original plan).

**Gate 1:** Piyush has a real `scored_hotspots.parquet` with ROI ≠ count proven. Prakhar has station + classification columns ready to merge.

---

### PHASE 2 — Merge `[BOTH, short joint session]`
Join Prakhar's `assigned_station`/`border_flag`/`classification`/`recommended_action` onto Piyush's `scored_hotspots.parquet` by `cluster_id`. Go column-by-column against the contract. Sanity-check top-ROI vs top-count divergence together.

**Gate 2:** One unified table with every contract column populated (BCI still stubbed, classification still recurrence-only). This is your backend's working baseline.

---

### PHASE 3 — Depth
**Piyush:** M7 BCI — replace the stub using the saved graph, re-run M1 with real BCI.
**Prakhar:** Validation script — hotspot stability, Precision@K, ROI-vs-count Spearman (~0.4–0.6 target), OSM coverage rate. Run it once on the Gate 2 baseline and again after Piyush's BCI lands, so you can show BCI's actual impact as a number.

**Gate 3:** Real BCI in ROI. Validation metrics in hand.

---

### PHASE 4 — Operations Layer
**Prakhar:**
1. M10 VRP Optimizer — uses Piyush's saved road graph + your own M18 station groups. Verify it's max-reward-with-skipping, not visit-all.
2. M12 Feedback Loop backend — SQLite schema + insert/read functions (no form UI yet).
3. M15 Infra Intel backend — SQLite schema for assessments + reportlab PDF generation for STRUCTURAL locations (no form UI yet).

**Piyush** (small support task): make `05_score.py` feedback-aware — read `feedback.sqlite`, push "enforced but recurred" clusters toward STRUCTURAL. Sync with Prakhar on the SQLite schema before writing this.

**Gate 4:** Routes produced (real or a sane hardcoded fallback). Feedback writes persist. Re-running the pipeline after a feedback write flips a classification — the loop closes.

---

### PHASE 5 — Hardening `[BOTH]`
- Full pipeline re-run end-to-end, timed, on a clean checkout.
- Column-by-column contract re-check, one last time.
- Git tag the working state.
- (Skip the demo-toggle/deck/Q&A rehearsal steps from the original §5 — those are frontend-demo specific. Revisit them once the dashboard track starts.)

---

## If you want to swap

The two tracks are self-contained on purpose — Piyush's is the geospatial/graph chain (P2→P4→M2→M1→M7), Prakhar's is everything else (classification, jurisdiction, routing, feedback, validation). You can hand either whole track to the other person without re-splitting anything; just don't split *within* a track, since that's where the blocking dependencies live.
