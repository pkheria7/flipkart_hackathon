# Prakhar Phase 2 — Merge Handoff Report

## Verdict

**PASS**

---

## Purpose

This file (`prakhar_cluster_features.parquet`) merges all Prakhar-side Phase 2
features — M3 peak patrol windows, M18 jurisdiction scoping, and M4 behavioral
classification — into a single, join-safe downstream handoff file.

It is the canonical source of Prakhar-derived features for:
- Piyush's M2 (LCLE scoring), M7 (BCI computation), M1 (ROI ranker)
- The final dashboard hotspot cards
- Any downstream API serving cluster metadata

This module does **not** compute any new features.  It only joins, resolves
column conflicts, adds handoff helper columns, and validates the result.

---

## Inputs Used

| File | Rows |
|------|------|
| `data/processed/cluster_summary.parquet` | 1,084 clusters (base) |
| `data/processed/cluster_peak_windows.parquet` | 1,084 rows (M3) |
| `data/processed/jurisdiction_clusters.parquet` | 1,084 rows (M18) |
| `data/processed/cluster_classification.parquet` | 1,084 rows (M4) |

---

## Outputs Created

| File | Rows | Columns |
|------|------|---------|
| `data/processed/prakhar_cluster_features.parquet` | 1084 | 70 |
| `data/processed/prakhar_cluster_features.csv` | 1084 | 70 |

---

## Merge Method

- `cluster_summary.parquet` is used as the **base table** (1 row per cluster).
- Three **left joins** on `cluster_id`: M3, M18, M4 in sequence.
- **No cluster_id is modified.**  All 1,084 cluster IDs pass through unchanged.
- **Duplicate columns** across inputs are resolved by explicit column selection
  before joining — no pandas `_x`/`_y` suffixes are ever generated.
- Each shared column is taken from the **canonical source** (see module docstring).
- **No final ROI scoring is done here** — this file feeds into Piyush's pipeline.

---

## Final Schema Summary

**Total columns:** 70

**Identity / location (from cluster_summary):**
`cluster_id`, `centroid_lat`, `centroid_lng`, `violation_count`, `unique_vehicle_types`, `dominant_vehicle_type`, `vehicle_mix`, `police_station_mode`, `location_mode`, `junction_name_mode`, `junction_flag_rate`, `has_junction_name_rate`, `first_seen_ist`, `last_seen_ist`, `active_days`, `active_weeks`, `peak_hour_basic`, `peak_day_basic`, `h3_cells_count`, `cluster_quality`, `needs_manual_review`

**M3 timing (from cluster_peak_windows):**
`peak_hour`, `peak_hour_count`, `peak_hour_share`, `top_3_hours`, `peak_day_name`, `peak_day_type`, `weekday_peak_hour`, `weekend_peak_hour`, `recommended_patrol_window`, `secondary_patrol_window`, `temporal_concentration_score`, `temporal_confidence`, `m3_notes`

**M18 jurisdiction (from jurisdiction_clusters):**
`assigned_station`, `station_assignment_method`, `station_assignment_confidence`, `station_cluster_rank`, `station_violation_rank`, `station_priority_band`, `is_top_station_hotspot`, `station_total_clusters`, `station_total_violations`, `station_needs_review_clusters`, `station_good_clusters`, `station_medium_clusters`, `cluster_violation_share_within_station`, `jurisdiction_notes`

**M4 classification (from cluster_classification):**
`observation_span_days`, `recurrence_rate_days`, `week_coverage_rate`, `avg_violations_per_active_day`, `max_daily_violations`, `top_day_share`, `weekend_share`, `weekday_share`, `hotspot_type`, `needs_review_flag`, `deployment_readiness`, `review_reason`, `primary_behavior_signal`, `behavior_signal_strength`, `recommended_action`, `classification_confidence`, `m4_reason`, `m4_notes`

**Handoff helper columns (computed here):**
`handoff_ready`, `handoff_warning`, `prakhar_feature_version`, `downstream_join_key`

---

## Summary Metrics

- **Total clusters:** 1084
- **Total violations represented:** 259,138
- **M3 join coverage:** 1084/1084 (100.0%)
- **M18 join coverage:** 1084/1084 (100.0%)
- **M4 join coverage:** 1084/1084 (100.0%)

**Hotspot type distribution (behavioral):**

| Type | Clusters |
|------|----------|
| STRUCTURAL | 243 |
| RESPONSIVE | 631 |
| SEASONAL | 210 |

**Deployment readiness distribution:**

| Readiness | Clusters |
|-----------|----------|
| READY | 496 |
| REVIEW_FIRST | 588 |

**Station priority band distribution:**

| Band | Clusters |
|------|----------|
| CRITICAL | 216 |
| HIGH | 236 |
| MEDIUM | 296 |
| LOW | 336 |

**Temporal confidence distribution (M3):**

| Confidence | Clusters |
|------------|----------|
| HIGH | 252 |
| MEDIUM | 620 |
| LOW | 212 |

**Classification confidence distribution (M4):**

| Confidence | Clusters |
|------------|----------|
| HIGH | 240 |
| MEDIUM | 632 |
| LOW | 212 |

---

## Top 20 Handoff Clusters

| cluster_id | assigned_station | violation_count | peak_hour | recommended_patrol_window | hotspot_type | deployment_readiness | station_priority_band | recommended_action |
|------------|-----------------|----------------|-----------|--------------------------|-------------|---------------------|----------------------|-------------------|
| C_0_1 | UPPARPET | 23,553 | 9 | 09:00-11:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_27_0 | SHIVAJINAGAR | 17,825 | 10 | 10:00-12:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_0_0 | CITY MARKET | 10,667 | 1 | 01:00-03:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_22 | MALLESHWARAM | 9,096 | 10 | 10:00-12:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_0_2 | UPPARPET | 8,323 | 9 | 09:00-11:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_333 | HAL OLD AIRPORT | 7,154 | 4 | 04:00-06:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_13 | MALLESHWARAM | 6,487 | 7 | 07:00-09:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_20 | KODIGEHALLI | 5,251 | 11 | 11:00-13:00 | STRUCTURAL | REVIEW_FIRST | HIGH | Review geography first; if confirmed, apply: Recurring patro |
| C_14 | SHIVAJINAGAR | 4,501 | 10 | 10:00-12:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_153 | VIJAYANAGARA | 4,474 | 4 | 04:00-06:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_171 | CHIKKAJALA | 4,437 | 5 | 05:00-07:00 | STRUCTURAL | REVIEW_FIRST | HIGH | Review geography first; if confirmed, apply: Recurring patro |
| C_3 | K.R. PURA | 3,926 | 0 | 00:00-02:00 | STRUCTURAL | REVIEW_FIRST | HIGH | Review geography first; if confirmed, apply: Recurring patro |
| C_15 | MALLESHWARAM | 3,813 | 8 | 08:00-10:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_41 | HEBBALA | 3,198 | 4 | 04:00-06:00 | STRUCTURAL | REVIEW_FIRST | MEDIUM | Review geography first; if confirmed, apply: Recurring patro |
| C_38 | HALASURU GATE | 3,040 | 10 | 10:00-12:00 | STRUCTURAL | REVIEW_FIRST | HIGH | Review geography first; if confirmed, apply: Recurring patro |
| C_39 | MALLESHWARAM | 2,928 | 10 | 10:00-12:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_327 | HIGH GROUND | 2,757 | 3 | 03:00-05:00 | STRUCTURAL | REVIEW_FIRST | MEDIUM | Review geography first; if confirmed, apply: Recurring patro |
| C_4 | VIJAYANAGARA | 2,677 | 11 | 11:00-13:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |
| C_54 | MAGADI ROAD | 2,407 | 11 | 11:00-13:00 | STRUCTURAL | REVIEW_FIRST | HIGH | Review geography first; if confirmed, apply: Recurring patro |
| C_81 | CITY MARKET | 2,187 | 11 | 11:00-13:00 | STRUCTURAL | REVIEW_FIRST | CRITICAL | Review geography first; if confirmed, apply: Recurring patro |

---

## Ready vs Review-First Summary

| Category | Clusters | Explanation |
|----------|----------|-------------|
| READY | 496 | Cleared for direct downstream planning and field deployment |
| REVIEW_FIRST | 588 | Rank and pre-plan allowed; field deployment needs operator/geographic sign-off |

**READY** clusters have `needs_review_flag = 0` — their geographic boundaries
were confirmed clean in Phase 2, and their behavioral classification is based
on sufficient temporal evidence.  They can be fed directly into VRP routing
and patrol scheduling.

**REVIEW_FIRST** clusters still carry a full behavioral `hotspot_type`
(STRUCTURAL/RESPONSIVE/SEASONAL) so downstream scoring can pre-rank them,
but the `recommended_action` is prefixed with 'Review geography first;'.
An operator must inspect the cluster boundary or station assignment before
dispatching enforcement resources.

---

## Verification Checks

| Check | Status | Detail |
|-------|--------|--------|
| one row per cluster summary | PASS | output=1084, summary=1084 |
| cluster id unique | PASS | unique=1084, rows=1084 |
| no noise rows | PASS | clean |
| cluster ids unchanged | PASS | match |
| m3 join 100pct | PASS | null count=0 |
| m18 join 100pct | PASS | null count=0 |
| m4 join 100pct | PASS | null count=0 |
| assigned station non null | PASS | null count=0 |
| hotspot type non null | PASS | null count=0 |
| hotspot type valid values | PASS | found={'SEASONAL', 'RESPONSIVE', 'STRUCTURAL'} |
| deployment readiness valid | PASS | found={'READY', 'REVIEW_FIRST'} |
| recommended patrol window non null | PASS | null count=0 |
| recommended action non null | PASS | null count=0 |
| station priority band non null | PASS | null count=0 |
| no suffix columns | PASS | clean |
| violation totals unchanged | PASS | summary=259138, output=259138 |

---

## Limitations

- **Feature handoff only — no ROI scoring done here.**  This file feeds
  Piyush's M2/M7/M1 pipeline.  The final `scored_hotspots.parquet` adds
  road capacity (OSM), BCI, and LCLE enforcement scores on top of these features.
- **No road-capacity / BCI / LCLE columns.**  Those come from Piyush's
  `04_enrich_osm.py` and `05_score.py` modules, which join on `cluster_id`.
- **REVIEW_FIRST clusters require human sign-off before field deployment.**
  The behavioral classification is valid and useful; only actual patrol
  dispatch is gated until an operator confirms the geography.
- **No enforcement outcome validation.**  `action_taken_timestamp` and
  `closed_datetime` are fully NULL in the source dataset — no feedback loop
  exists until M12 (Feedback Loop) is implemented.
- **Station assignment is FTVR-observed** (`police_station_mode`), not legal
  boundary mapping.  Clusters that span multiple station areas may be
  assigned to the most frequently observed station only.

---

## Final Recommendation

Prakhar's merged feature file is ready for handoff to Piyush.
Join on `cluster_id` (or equivalently `downstream_join_key`).
All Prakhar-side features — peak timing, jurisdiction, and behavioral
classification — are available in one place with no suffix ambiguity.
File: `data/processed/prakhar_cluster_features.parquet` (1084 rows, 70 columns).
