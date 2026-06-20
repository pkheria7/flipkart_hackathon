# Gate 3 Validation Report

## 1. Executive Verdict

**PASS**

---

## 2. Input Files Used

| File | Status |
|------|--------|
| `data/outputs/scored_hotspots.parquet` | EXISTS |
| `data/outputs/scored_hotspots.csv` | EXISTS |
| Rows loaded | 1,084 |
| Columns | 18 |

---

## 3. Schema Validation

| Check | Status | Detail |
|-------|--------|--------|
| csv exists | PASS | C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\outputs\scored_hotspots.csv |
| parquet exists | PASS | C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\outputs\scored_hotspots.parquet |
| row count | PASS | 1084 rows (expected 1084) |
| cluster id unique | PASS | unique=1084, rows=1084 |
| no noise rows | PASS | clean |
| required columns present | PASS | all present |
| no nulls in required cols | PASS | clean |

---

## 4. Score / Range Validation

| Check | Status | Detail |
|-------|--------|--------|
| roi score range | PASS | min=0.3690, max=100.0000 |
| lcle pct range | PASS | min=6.79, max=100.00 |
| bci range | PASS | min=0.000000, max=1.000000 |
| road width positive | PASS | min=3.00, zero_or_neg=0 |
| violation count positive | PASS | min=3, zero_or_neg=0 |
| border flag all zero stub | PASS | all 0 (confirmed stub) |
| osm coverage binary | PASS | values=[0, 1] |

> **Note on `osm_coverage`:** Binary flag (1 = OSM road matched, 0 = no match).
> Not a percentage. 583 clusters (53.8%) have no OSM match; their road attributes
> are estimated from IRC defaults or cluster density.

> **Note on `border_flag`:** Stubbed to 0 for all clusters. M18 jurisdiction
> scoping does not currently compute an explicit inter-station boundary flag.
> This is a known limitation, not a pipeline error.

---

## 5. Ranking-Quality Metrics

ROI score is a **percentile-rank** of raw ROI (not a direct formula output),
so its distribution is approximately uniform by construction. Spearman correlations
reflect how much each factor influences cluster rank.

| Metric | Value | p-value | Interpretation |
|--------|-------|---------|----------------|
| roi_score vs violation_count | 0.5490 | 2.3223e-86 | ACCEPTABLE: decision-intelligence zone |
| roi_score vs lcle_pct | -0.0492 | 1.0558e-01 |  |
| roi_score vs bci | 0.8328 | 3.8303e-280 |  |
| roi_score vs persistence | 0.4813 | 6.1141e-64 |  |
| roi_score vs recurrence | 0.5296 | 2.1302e-79 |  |

**Top-K overlap (ROI vs violation_count):**

| K | Overlap | %  |
|---|---------|-----|
| 10 | 2/10 | 20.0% |
| 20 | 6/20 | 30.0% |
| 50 | 26/50 | 52.0% |

> Top-K overlap shows how many clusters appear in BOTH the top-K by ROI and
> top-K by raw violation count. Lower overlap = more intelligence signal beyond
> brute-force count ranking. Acceptable divergence: < 60% overlap at K=20.

---

## 6. Precision@K (Proxy, No Ground Truth)

A cluster is a **high-impact proxy positive** if it satisfies ≥ 2 of:
- `lcle_pct >= 60` (high capacity-loss estimate)
- `bci >= 0.0416` (≥ 75th percentile betweenness criticality)
- `persistence >= 15.0` (≥ 75th percentile peak-hour violations per officer-hour)
- `recurrence >= 0.6522` (≥ 75th percentile week coverage)
- `road_class` in high-quality classes (motorway, motorway_link, primary, primary_link, secondary, secondary_link, trunk, trunk_link)

**Total proxy positives across all 1,084 clusters:** 439

| K | Hits in Top-K ROI | Precision@K |
|---|------------------|-------------|
| 10 | 10/10 | 100.0% |
| 20 | 20/20 | 100.0% |
| 50 | 50/50 | 100.0% |

> **Caveat:** Ground-truth enforcement outcome data does not exist in this dataset.
> (`action_taken_timestamp` and `closed_datetime` are fully NULL.)
> Precision@K here is a **proxy metric** using correlated structural signals,
> not measured enforcement success rates.

---

## 7. Hotspot Stability / Recurrence Summary

- `recurrence` = active_weeks / 23 (normalised to [0,1])
- `persistence` = peak_hour_count / 2.0 (violations per officer-hour in peak window; NOT normalised)

**Recurrence distribution:**

| Stat | Value |
|------|-------|
| count | 1084.0000 |
| mean | 0.4632 |
| std | 0.2774 |
| min | 0.0435 |
| 25% | 0.2609 |
| 50% | 0.3913 |
| 75% | 0.6522 |
| max | 1.0000 |

**Persistence distribution (raw count):**

| Stat | Value |
|------|-------|
| count | 1084.00 |
| mean | 25.52 |
| std | 94.87 |
| min | 1.00 |
| 25% | 4.00 |
| 50% | 7.00 |
| 75% | 15.00 |
| max | 1786.00 |

- Clusters with `recurrence >= 0.6522` (75th pct): **301**
- Clusters with `persistence >= 15.0` (75th pct): **275**

**Classification distribution:**

| Classification | Clusters |
|---------------|----------|
| RESPONSIVE | 631 |
| STRUCTURAL | 243 |
| SEASONAL | 210 |

**Top-20 ROI clusters classification mix:**

| Classification | Count |
|---------------|-------|
| STRUCTURAL | 20 |

---

## 8. OSM Coverage Summary

| osm_coverage | Clusters | % |
|-------------|----------|---|
| 0 (no OSM match) | 583 | 53.8% |
| 1 (OSM matched) | 501 | 46.2% |

> Clusters without OSM match use IRC default road widths — LCLE estimates
> for those clusters carry higher uncertainty (`lcle_confidence = LOW`).

**road_class distribution:**

| road_class | Clusters |
|-----------|----------|
| tertiary | 362 |
| secondary | 244 |
| primary | 200 |
| residential | 191 |
| trunk | 35 |
| unclassified ⚠ | 15 |
| primary_link | 11 |
| motorway_link | 10 |
| trunk_link | 7 |
| secondary_link | 5 |
| living_street ⚠ | 3 |
| motorway | 1 |

**road_width_m summary:**

| Stat | Value |
|------|-------|
| count | 1084.00 |
| mean | 5.80 |
| std | 2.24 |
| min | 3.00 |
| 25% | 4.00 |
| 50% | 6.00 |
| 75% | 7.00 |
| max | 17.50 |

---

## 9. BCI Impact Summary

- **BCI 90th percentile:** 0.111337
- **Violation count median:** 36
- **ROI score 80th percentile:** 80.02

**Low-count / high-BCI clusters** (count ≤ median AND bci ≥ 90th pct):
→ **42 clusters**

**Low-count / high-ROI clusters** (count ≤ median AND roi_score ≥ 80th pct):
→ **19 clusters**

> These counts prove that the ROI model is **not merely sorting by raw violation count**.
> A cluster with few violations but a high BCI (critical road graph node) and high LCLE
> (narrow, congested road) can outrank a high-count cluster on a wide arterial.

**Top 20 clusters by BCI:**

| cluster_id | violation_count | road_class | lcle_pct | bci | roi_score |
|------------|-----------------|------------|----------|-----|-----------|
| C_112 | 319 | trunk | 27.14 | 1.0000 | 98.43 |
| C_380 | 82 | trunk | 23.71 | 1.0000 | 96.40 |
| C_293 | 114 | trunk | 24.11 | 0.9854 | 97.32 |
| C_693 | 56 | trunk | 23.52 | 0.9724 | 96.13 |
| C_149 | 1,807 | trunk | 40.32 | 0.8742 | 99.72 |
| C_183 | 509 | trunk | 23.54 | 0.8296 | 98.71 |
| C_276 | 47 | trunk | 30.11 | 0.7314 | 95.66 |
| C_294 | 42 | trunk | 21.71 | 0.7314 | 94.19 |
| C_432 | 27 | trunk | 15.17 | 0.7129 | 89.76 |
| C_876 | 30 | trunk | 28.00 | 0.6981 | 92.62 |
| C_298 | 1,409 | trunk | 50.94 | 0.6915 | 100.00 |
| C_245 | 535 | trunk | 34.22 | 0.6884 | 99.17 |
| C_430 | 23 | trunk | 24.90 | 0.6839 | 93.82 |
| C_102 | 142 | trunk | 25.68 | 0.6670 | 97.42 |
| C_303 | 413 | trunk | 29.98 | 0.6320 | 98.34 |
| C_104 | 1,090 | trunk | 44.95 | 0.6260 | 99.45 |
| C_565 | 33 | trunk | 54.96 | 0.5567 | 85.70 |
| C_78 | 22 | secondary | 36.08 | 0.5561 | 90.96 |
| C_199 | 1,874 | trunk | 44.31 | 0.5312 | 99.63 |
| C_2 | 129 | trunk | 22.40 | 0.5269 | 96.77 |

---

## 10. Top 20 ROI Hotspots

| rank | cluster_id | assigned_station | violation_count | road_class | lcle_pct | bci | persistence | recurrence | peak_window | roi_score | classification | recommended_action |
|------|------------|-----------------|----------------|------------|---------|-----|-------------|------------|-------------|-----------|----------------|-------------------|
| 1 | C_298 | HAL OLD AIRPORT | 1,409 | trunk | 50.94 | 0.6915 | 239.0 | 0.9130 | 08:00-10:00 | 100.00 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 2 | C_0_0 | CITY MARKET | 10,667 | primary | 75.62 | 0.1175 | 742.0 | 1.0000 | 01:00-03:00 | 99.91 | STRUCTURAL | Recurring patrol + towing support + signage/infra revie |
| 3 | C_22 | MALLESHWARAM | 9,096 | secondary | 91.13 | 0.1407 | 728.0 | 1.0000 | 10:00-12:00 | 99.82 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 4 | C_149 | MAHADEVAPURA | 1,807 | trunk | 40.32 | 0.8742 | 161.0 | 1.0000 | 10:00-12:00 | 99.72 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 5 | C_199 | MAHADEVAPURA | 1,874 | trunk | 44.31 | 0.5312 | 225.0 | 0.9565 | 01:00-03:00 | 99.63 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 6 | C_126 | HAL OLD AIRPORT | 939 | trunk_link | 100.00 | 0.3813 | 152.0 | 0.9565 | 08:00-10:00 | 99.54 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 7 | C_104 | BELLANDUR | 1,090 | trunk | 44.95 | 0.6260 | 108.5 | 0.9565 | 02:00-04:00 | 99.45 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 8 | C_18 | BYATARAYANAPURA | 1,602 | trunk | 45.13 | 0.2736 | 128.0 | 1.0000 | 01:00-03:00 | 99.35 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 9 | C_229 | HALASUR | 1,139 | primary | 38.91 | 0.1949 | 191.5 | 1.0000 | 04:00-06:00 | 99.26 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 10 | C_245 | RAJAJINAGAR | 535 | trunk | 34.22 | 0.6884 | 58.5 | 1.0000 | 11:00-13:00 | 99.17 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 11 | C_20 | KODIGEHALLI | 5,251 | secondary | 33.86 | 0.0850 | 646.0 | 1.0000 | 11:00-13:00 | 99.08 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 12 | C_58 | MAHADEVAPURA | 1,253 | primary | 39.94 | 0.1704 | 143.5 | 1.0000 | 11:00-13:00 | 98.99 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 13 | C_38 | HALASURU GATE | 3,040 | secondary | 61.90 | 0.0752 | 298.5 | 1.0000 | 10:00-12:00 | 98.89 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 14 | C_261 | YELAHANKA | 665 | tertiary | 70.96 | 0.1733 | 149.0 | 0.9565 | 02:00-04:00 | 98.80 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 15 | C_183 | YESHWANTHPURA | 509 | trunk | 23.54 | 0.8296 | 44.0 | 0.9565 | 09:00-11:00 | 98.71 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 16 | C_3 | K.R. PURA | 3,926 | residential | 100.00 | 0.0584 | 469.0 | 1.0000 | 00:00-02:00 | 98.62 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 17 | C_14 | SHIVAJINAGAR | 4,501 | tertiary | 100.00 | 0.0386 | 331.0 | 1.0000 | 10:00-12:00 | 98.52 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |
| 18 | C_112 | YESHWANTHPURA | 319 | trunk | 27.14 | 1.0000 | 26.5 | 0.8696 | 08:00-10:00 | 98.43 | STRUCTURAL | Recurring patrol + towing support + signage/infra revie |
| 19 | C_303 | MAHADEVAPURA | 413 | trunk | 29.98 | 0.6320 | 39.5 | 0.8261 | 03:00-05:00 | 98.34 | STRUCTURAL | Recurring patrol + towing support + signage/infra revie |
| 20 | C_177 | HSR LAYOUT | 341 | trunk | 25.21 | 0.3416 | 56.5 | 1.0000 | 02:00-04:00 | 98.25 | STRUCTURAL | Review geography first; if confirmed, apply: Recurring  |

---

## 11. Suspicious Cases

| Category | Count | Notes |
|----------|-------|-------|
| roi_score ≥ 95 AND violation_count < median | 0 | none |
| lcle_pct = 100 AND road_width_m ≥ 7m | 0 | clean |
| bci ≤ 0.001 in top-20 by violation_count | 6 | these count-dominant clusters have low graph criticality — expected on residential roads |
| empty/UNKNOWN assigned_station | 0 | clean |
| UNKNOWN peak_window | 0 | clean |
| empty recommended_action | 0 | clean |
| road_width_m ≤ 0 | 0 | clean |
| min roi_score ties | 7 clusters at 0.3690 | expected — clusters with bci≈0 all share raw_roi=0 and same percentile rank |

---

## 12. Limitations

- **LCLE is a capacity-loss proxy, not measured congestion delay.**
  It estimates how much road width is lost to parked vehicles based on
  road width (OSM or IRC default), vehicle mix, and occupancy proxy.
  Actual traffic speed reduction is not measured.
- **BCI is a graph-criticality proxy, not live traffic criticality.**
  It is derived from edge betweenness centrality and alternative-route
  availability in the OSM road graph. Live traffic volumes are not available.
- **Precision@K is proxy-based.**  No ground-truth enforcement outcome data
  exists. `action_taken_timestamp` and `closed_datetime` are fully NULL
  in the FTVR source dataset. Precision@K uses correlated structural signals
  as a stand-in for enforcement effectiveness.
- **`border_flag` is stubbed to 0.**  M18 jurisdiction scoping does not
  currently compute inter-station boundary flags. When implemented, border
  clusters may require joint-station patrol coordination.
- **`osm_coverage = 0` clusters use IRC default road widths.**
  46.2% of clusters have no direct OSM road match. Their LCLE estimates carry
  higher uncertainty and are marked `lcle_confidence = LOW` in enriched_clusters.
- **ROI score is a percentile rank, not an absolute enforcement value.**
  Rank 100 means the best cluster in this dataset by the current formula;
  it does not mean this cluster guarantees the most enforcement outcomes.
- **No temporal split validation is possible.**  The dataset spans
  approximately Nov 2023 – Apr 2024 (151 days). A proper train/test
  temporal split would require data beyond this window.

---

## 13. Final Recommendation

Gate 3 scored output is **pass** for downstream use.

- Schema integrity, score ranges, and uniqueness constraints are all verified clean.
- ROI ranking shows meaningful divergence from raw violation count — the model
  incorporates road criticality (BCI), capacity-loss (LCLE), and temporal signal
  (recurrence, persistence) beyond brute-force sorting.
- Known limitations (border_flag stub, OSM coverage gaps, no outcome labels)
  are documented and do not constitute pipeline errors.

**Downstream consumers (dashboard, M10 VRP, M12 Feedback) should join on
`cluster_id` from `data/outputs/scored_hotspots.parquet`.**

**Do not re-run scoring unless a formula bug is identified — the Gate 3
output is frozen as of this validation.**
