# Prakhar Phase 2 — M3 Peak Window Report

## Verdict

**PASS**

---

## Inputs Used

| File | Rows |
|------|------|
| `data/processed/cluster_handoff_for_prakhar.parquet` | 259,138 (clustered, NOISE excluded) |
| `data/processed/cluster_summary.parquet` | 1,084 clusters |

---

## Outputs Created

| File | Rows |
|------|------|
| `data/processed/cluster_peak_windows.parquet` | 1084 |
| `data/processed/cluster_peak_windows.csv` | 1084 |

---

## Method

**Noise filtering:**  Rows with `is_clustered != 1` or `cluster_id == 'NOISE'` are
excluded before any computation.  The 39,139 noise rows from Phase 2 are never
included in the peak window analysis.

**Peak hour calculation:**  For each cluster, violations are counted per IST hour
(0–23) using the pre-computed `hour` column in the handoff file.  The hour with the
highest total count across all days becomes `peak_hour`.  No assumptions about
morning/evening are baked in — the data decides.

**Weekday / weekend handling:**  Separate peak hours are computed for weekday rows
(`is_weekend == 0`) and weekend rows (`is_weekend == 1`).  `peak_day_type` is
classified as WEEKDAY if ≥ 65 % of violations occur on weekdays, WEEKEND if ≥ 65 %
occur on weekends, and MIXED otherwise.

**Recommended patrol window:**  The window starts at `peak_hour` and runs for two
hours.  Midnight wrap is handled safely (hour 23 -> 23:00-01:00).  The secondary
window uses the second-highest violation hour.

**Temporal concentration score:**  Share of total violations falling in the top-3
hours.  A uniform distribution across 24 hours gives ~0.125; a tightly
concentrated peak can reach > 0.6.

**Temporal confidence rules (deterministic):**

| Tier | Condition |
|------|-----------|
| HIGH | total_violations ≥ 100 AND active_days ≥ 14 AND concentration ≥ 0.25 |
| MEDIUM | total_violations ≥ 30 OR active_days ≥ 7 (and not HIGH) |
| LOW | all other cases (sparse data or flat distribution) |

---

## Summary Metrics

- **Clusters processed:** 1084
- **Clustered violation rows used:** 259,138

**Peak hour distribution (hour → cluster count):**

| Hour | Clusters |
|------|----------|
| 00:00 | 13 |
| 01:00 | 22 |
| 02:00 | 75 |
| 03:00 | 115 |
| 04:00 | 107 |
| 05:00 | 68 |
| 06:00 | 62 |
| 07:00 | 79 |
| 08:00 | 79 |
| 09:00 | 70 |
| 10:00 | 118 |
| 11:00 | 159 |
| 12:00 | 60 |
| 13:00 | 36 |
| 14:00 | 12 |
| 15:00 | 2 |
| 16:00 | 1 |
| 17:00 | 2 |
| 23:00 | 4 |

**Temporal confidence distribution:**

| Confidence | Clusters |
|------------|----------|
| HIGH | 252 |
| MEDIUM | 620 |
| LOW | 212 |

**Weekday / Weekend / Mixed distribution:**

| Day Type | Clusters |
|----------|----------|
| WEEKDAY | 691 |
| WEEKEND | 76 |
| MIXED | 317 |

---

## Top 15 Peak Window Recommendations

| cluster_id | total_violations | peak_hour | recommended_patrol_window | peak_day_type | temporal_confidence |
|------------|-----------------|-----------|--------------------------|---------------|---------------------|
| C_0_1 | 23,553 | 09:00 | 09:00-11:00 | WEEKDAY | HIGH |
| C_27_0 | 17,825 | 10:00 | 10:00-12:00 | MIXED | HIGH |
| C_0_0 | 10,667 | 01:00 | 01:00-03:00 | WEEKDAY | HIGH |
| C_22 | 9,096 | 10:00 | 10:00-12:00 | MIXED | HIGH |
| C_0_2 | 8,323 | 09:00 | 09:00-11:00 | WEEKDAY | HIGH |
| C_333 | 7,154 | 04:00 | 04:00-06:00 | WEEKDAY | HIGH |
| C_13 | 6,487 | 07:00 | 07:00-09:00 | WEEKDAY | HIGH |
| C_20 | 5,251 | 11:00 | 11:00-13:00 | WEEKDAY | HIGH |
| C_14 | 4,501 | 10:00 | 10:00-12:00 | WEEKDAY | HIGH |
| C_153 | 4,474 | 04:00 | 04:00-06:00 | WEEKDAY | HIGH |
| C_171 | 4,437 | 05:00 | 05:00-07:00 | WEEKDAY | HIGH |
| C_3 | 3,926 | 00:00 | 00:00-02:00 | WEEKDAY | HIGH |
| C_15 | 3,813 | 08:00 | 08:00-10:00 | WEEKDAY | HIGH |
| C_41 | 3,198 | 04:00 | 04:00-06:00 | WEEKDAY | HIGH |
| C_38 | 3,040 | 10:00 | 10:00-12:00 | WEEKDAY | HIGH |

---

## Needs-Review Clusters (Top 10 by violation count)

These clusters were flagged `needs_manual_review = 1` in Phase 2.  Their peak
windows are computed normally but should be interpreted with care as they may
cover large geographic areas.

| cluster_id | total_violations | peak_hour | recommended_patrol_window | temporal_confidence |
|------------|-----------------|-----------|--------------------------|---------------------|
| C_0_1 | 23,553 | 09:00 | 09:00-11:00 | HIGH |
| C_27_0 | 17,825 | 10:00 | 10:00-12:00 | HIGH |
| C_0_0 | 10,667 | 01:00 | 01:00-03:00 | HIGH |
| C_22 | 9,096 | 10:00 | 10:00-12:00 | HIGH |
| C_0_2 | 8,323 | 09:00 | 09:00-11:00 | HIGH |
| C_333 | 7,154 | 04:00 | 04:00-06:00 | HIGH |
| C_13 | 6,487 | 07:00 | 07:00-09:00 | HIGH |
| C_20 | 5,251 | 11:00 | 11:00-13:00 | HIGH |
| C_14 | 4,501 | 10:00 | 10:00-12:00 | HIGH |
| C_153 | 4,474 | 04:00 | 04:00-06:00 | HIGH |

---

## Verification Checks

| Check | Status |
|-------|--------|
| output file exists | PASS |
| one row per cluster | PASS |
| no noise rows | PASS |
| cluster id unique | PASS |
| no missing peak hour | PASS |
| hour values valid | PASS |
| cluster ids match summary | PASS |
| recommended window non null | PASS |
| confidence values valid | PASS |

---

## Limitations

- Peak windows are derived from **historical violation timestamps**, not from live
  traffic speed or congestion sensor data.  A window with many logged violations
  is a proxy for likely peak enforcement need, not a direct congestion measurement.
- The recommended patrol window is a **data-driven suggestion**.  It does not
  guarantee congestion reduction — that depends on road geometry and vehicle
  types (computed in M2 LCLE, Piyush's module).
- **Large needs-review clusters** (e.g. C_0_1, C_27_0) cover multiple
  intersections.  Their single peak hour aggregates diverse micro-locations;
  sub-cluster-level patrol windows would be more precise.
- `active_days` and `active_weeks` are sourced from the cluster_summary to stay
  consistent with Phase 2 outputs.  They reflect the observation window of the
  dataset (~Nov 2023 – Apr 2024), not recent operational trends.

---

## Final Recommendation

M3 outputs are ready to merge into Prakhar Phase 2.
The `cluster_peak_windows.parquet` file is safe to join onto `cluster_summary` by
`cluster_id` and hand off to M18 (Jurisdiction Scoping) and M4 (Classifier).
The `recommended_patrol_window` and `temporal_confidence` columns feed directly
into the final scored_hotspots schema.
