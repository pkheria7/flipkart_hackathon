# Prakhar Phase 2 — M18 Jurisdiction Scoping Report

## Verdict

**PASS**

---

## Inputs Used

| File | Rows |
|------|------|
| `data/processed/cluster_summary.parquet` | 1,084 clusters |
| `data/processed/cluster_peak_windows.parquet` | 1084 clusters (M3, optional) |

---

## Outputs Created

| File | Rows |
|------|------|
| `data/processed/jurisdiction_clusters.parquet` | 1084 |
| `data/processed/jurisdiction_clusters.csv` | 1084 |
| `data/processed/station_workload_summary.parquet` | 54 |
| `data/processed/station_workload_summary.csv` | 54 |

---

## Method

**Station assignment:** Each cluster is assigned to a station using the
`police_station_mode` column from `cluster_summary.parquet` — the most
frequently observed police station tag on violations within that cluster.
No GIS polygon boundaries or spatial joins are used in this module.
This is *FTVR-observed jurisdiction*, not official legal boundary assignment.

**Assignment confidence rules (deterministic):**

| Tier | Condition |
|------|-----------|
| HIGH | police_station_mode non-null AND cluster_quality in {good, medium} AND needs_manual_review == 0 |
| MEDIUM | police_station_mode non-null AND (cluster_quality == needs_review OR needs_manual_review == 1) |
| LOW | police_station_mode null or empty |

**Station workload:** Total violations, cluster count, good/medium/needs_review
split, average and max cluster size are aggregated per assigned station.

**Hotspot ranking within station:** Clusters are ranked by `violation_count`
descending within each station.  The `is_top_station_hotspot` flag is set for
the top N clusters where N = min(10, max(3, floor(station_total_clusters * 0.20))).
This ensures at least 3 flagged hotspots per station and a maximum of 10,
capturing the busiest 20% as a sensible middle ground.

**Station priority bands** (based on station total violations, not per-cluster):

| Band | Threshold |
|------|-----------|
| CRITICAL | >= 90th percentile of all station totals (approx >= 12,800 violations) |
| HIGH | >= 75th percentile (approx >= 4,500 violations) |
| MEDIUM | >= 50th percentile (approx >= 2,400 violations) |
| LOW | below median |

**Limitation:** Station assignment reflects where violations were recorded, not
official police station operational boundaries.  Clusters near station borders
may be logged under either neighbouring station depending on officer deployment.

M3 peak windows joined onto station workload summary.

---

## Summary Metrics

- **Clusters processed:** 1084
- **Police stations:** 54
- **Total violations represented:** 259,138
- **Top-station hotspots flagged:** 225

**Station assignment confidence distribution:**

| Confidence | Clusters |
|------------|----------|
| HIGH | 496 |
| MEDIUM | 588 |
| LOW | 0 |

**Station priority band distribution (cluster count):**

| Band | Clusters |
|------|----------|
| CRITICAL | 216 |
| HIGH | 236 |
| MEDIUM | 296 |
| LOW | 336 |

---

## Top 15 Stations by Violation Burden

| assigned_station | station_total_violations | station_total_clusters | station_priority_band | top_cluster_id | top_cluster_violations |
|-----------------|--------------------------|----------------------|----------------------|----------------|------------------------|
| UPPARPET | 36,360 | 33 | CRITICAL | C_0_1 | 23,553 |
| SHIVAJINAGAR | 27,458 | 35 | CRITICAL | C_27_0 | 17,825 |
| MALLESHWARAM | 24,086 | 28 | CRITICAL | C_22 | 9,096 |
| HAL OLD AIRPORT | 19,446 | 51 | CRITICAL | C_333 | 7,154 |
| CITY MARKET | 15,655 | 36 | CRITICAL | C_0_0 | 10,667 |
| VIJAYANAGARA | 14,536 | 33 | CRITICAL | C_153 | 4,474 |
| KODIGEHALLI | 8,738 | 33 | HIGH | C_20 | 5,251 |
| MAGADI ROAD | 7,483 | 40 | HIGH | C_54 | 2,407 |
| RAJAJINAGAR | 6,236 | 46 | HIGH | C_83 | 1,240 |
| CHIKKAJALA | 6,107 | 17 | HIGH | C_171 | 4,437 |
| MAHADEVAPURA | 6,005 | 20 | HIGH | C_199 | 1,874 |
| K.R. PURA | 5,830 | 14 | HIGH | C_3 | 3,926 |
| JEEVANBHEEMANAGAR | 5,678 | 35 | HIGH | C_373 | 1,214 |
| HALASURU GATE | 4,524 | 31 | HIGH | C_38 | 3,040 |
| HSR LAYOUT | 4,491 | 34 | MEDIUM | C_114 | 1,086 |

---

## Top 20 Station Hotspots

| cluster_id | assigned_station | violation_count | station_cluster_rank | is_top_station_hotspot | station_assignment_confidence | station_priority_band |
|------------|-----------------|----------------|---------------------|----------------------|------------------------------|----------------------|
| C_0_1 | UPPARPET | 23,553 | 1 | 1 | MEDIUM | CRITICAL |
| C_27_0 | SHIVAJINAGAR | 17,825 | 1 | 1 | MEDIUM | CRITICAL |
| C_0_0 | CITY MARKET | 10,667 | 1 | 1 | MEDIUM | CRITICAL |
| C_22 | MALLESHWARAM | 9,096 | 1 | 1 | MEDIUM | CRITICAL |
| C_0_2 | UPPARPET | 8,323 | 2 | 1 | MEDIUM | CRITICAL |
| C_333 | HAL OLD AIRPORT | 7,154 | 1 | 1 | MEDIUM | CRITICAL |
| C_13 | MALLESHWARAM | 6,487 | 2 | 1 | MEDIUM | CRITICAL |
| C_20 | KODIGEHALLI | 5,251 | 1 | 1 | MEDIUM | HIGH |
| C_14 | SHIVAJINAGAR | 4,501 | 2 | 1 | MEDIUM | CRITICAL |
| C_153 | VIJAYANAGARA | 4,474 | 1 | 1 | MEDIUM | CRITICAL |
| C_171 | CHIKKAJALA | 4,437 | 1 | 1 | MEDIUM | HIGH |
| C_3 | K.R. PURA | 3,926 | 1 | 1 | MEDIUM | HIGH |
| C_15 | MALLESHWARAM | 3,813 | 3 | 1 | MEDIUM | CRITICAL |
| C_41 | HEBBALA | 3,198 | 1 | 1 | MEDIUM | MEDIUM |
| C_38 | HALASURU GATE | 3,040 | 1 | 1 | MEDIUM | HIGH |
| C_39 | MALLESHWARAM | 2,928 | 4 | 1 | MEDIUM | CRITICAL |
| C_327 | HIGH GROUND | 2,757 | 1 | 1 | MEDIUM | MEDIUM |
| C_4 | VIJAYANAGARA | 2,677 | 2 | 1 | MEDIUM | CRITICAL |
| C_54 | MAGADI ROAD | 2,407 | 1 | 1 | MEDIUM | HIGH |
| C_81 | CITY MARKET | 2,187 | 2 | 1 | MEDIUM | CRITICAL |

---

## Needs-Review Jurisdiction Cases

Clusters with `needs_manual_review == 1` sorted by violation count.
These may span station boundaries or represent unusually large geographic areas.

| cluster_id | assigned_station | violation_count | cluster_quality | assignment_confidence | jurisdiction_notes |
|------------|-----------------|----------------|----------------|----------------------|-------------------|
| C_0_1 | UPPARPET | 23,553 | needs_review | MEDIUM | cluster flagged for review; cluster quality: needs_review; dominates station (65% of station violations) |
| C_27_0 | SHIVAJINAGAR | 17,825 | needs_review | MEDIUM | cluster flagged for review; cluster quality: needs_review; dominates station (65% of station violations) |
| C_0_0 | CITY MARKET | 10,667 | needs_review | MEDIUM | cluster flagged for review; cluster quality: needs_review; dominates station (68% of station violations) |
| C_22 | MALLESHWARAM | 9,096 | good | MEDIUM | cluster flagged for review; dominates station (38% of station violations) |
| C_0_2 | UPPARPET | 8,323 | good | MEDIUM | cluster flagged for review |
| C_333 | HAL OLD AIRPORT | 7,154 | good | MEDIUM | cluster flagged for review; dominates station (37% of station violations) |
| C_13 | MALLESHWARAM | 6,487 | good | MEDIUM | cluster flagged for review |
| C_20 | KODIGEHALLI | 5,251 | good | MEDIUM | cluster flagged for review; dominates station (60% of station violations) |
| C_14 | SHIVAJINAGAR | 4,501 | good | MEDIUM | cluster flagged for review |
| C_153 | VIJAYANAGARA | 4,474 | good | MEDIUM | cluster flagged for review; dominates station (31% of station violations) |

---

## Verification Checks

| Check | Status |
|-------|--------|
| jc output exists | PASS |
| sw output exists | PASS |
| one row per cluster | PASS |
| cluster id unique | PASS |
| cluster ids match summary | PASS |
| assigned station non null | PASS |
| station count consistent | PASS |
| violation totals match | PASS |
| priority bands valid | PASS |
| m3 peak window joined ok | PASS |

---

## Limitations

- Station assignment uses `police_station_mode` (most common station tag on
  violations in each cluster), **not** official polygon boundary mapping.
  Clusters near station borders may be assigned to either neighbouring station.
- Mixed-station edge cases: clusters with violations logged under two stations
  nearly equally will be assigned to one by mode — the minority gets dropped.
- Station burden reflects **recorded violations**, not the total population of
  illegal parking events.  Under-enforced areas will appear lower-burden.
- No officer availability, shift strength, or vehicle allocation data is
  incorporated.  Workload numbers are violation counts, not officer-hours.

---

## Final Recommendation

M18 outputs are ready to merge into Prakhar Phase 2.
The `jurisdiction_clusters.parquet` and `station_workload_summary.parquet` files
are safe to join onto downstream modules (M4 Classifier, M10 VRP) by `cluster_id`
and `assigned_station` respectively.
The `station_priority_band`, `is_top_station_hotspot`, and `assigned_station`
columns feed directly into the final scored_hotspots schema.
