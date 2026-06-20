# Prakhar Phase 2 — M4 Structural vs Responsive Classifier Report (v2)

## Verdict

**PASS**

---

## Design Fix Summary

**Old design (v1):** `hotspot_type` could be NEEDS_REVIEW, which overrode
behavioral classification.  This mixed two unrelated concerns — *what behavior*
does the cluster show vs *is it safe to deploy enforcement here*.

**New design (v2):** These are now fully separate layers.

| Layer | Column | Values |
|-------|--------|--------|
| Behavioral | `hotspot_type` | STRUCTURAL / RESPONSIVE / SEASONAL |
| Deployment gate | `deployment_readiness` | READY / REVIEW_FIRST |
| Review flag | `needs_review_flag` | 0 / 1 |
| Review explanation | `review_reason` | human-readable string |

Every cluster now gets a behavioral type regardless of review status.
A REVIEW_FIRST cluster still shows its behavioral type (e.g. STRUCTURAL)
so downstream modules can pre-rank and pre-plan enforcement, while the
deployment gate prevents premature field deployment.

The `recommended_action` now combines both layers:
- READY: base action (e.g. "Recurring patrol + towing...")
- REVIEW_FIRST: "Review geography first; if confirmed, apply: <base action>"

---

## Inputs Used

| File | Rows |
|------|------|
| `data/processed/cluster_handoff_for_prakhar.parquet` | row-level (clustered rows only) |
| `data/processed/cluster_summary.parquet` | 1,084 clusters |
| `data/processed/cluster_peak_windows.parquet` | 1084 clusters (M3) |
| `data/processed/jurisdiction_clusters.parquet` | 1084 clusters (M18) |

---

## Outputs Created

| File | Rows |
|------|------|
| `data/processed/cluster_classification.parquet` | 1084 |
| `data/processed/cluster_classification.csv` | 1084 |

---

## Method

**Layer 1 — Behavioral classification (pure, ignores review flags):**

Applied in priority order:

1. **STRUCTURAL** — `active_days >= 30 AND active_weeks >= 8` (rule A),
   OR `recurrence_rate_days >= 0.25 AND active_weeks >= 6` (rule B).
   Signal: `recurrent_across_weeks`

2. **SEASONAL** — `weekend_share >= 0.45` OR `peak_day_type == WEEKEND` (M3).
   Signal: `weekend_dominant`

3. **RESPONSIVE** — default for all others, including bursty (`top_day_share >= 0.35`),
   short-term (`active_days < 14 AND violations >= 50`), and sparse clusters.
   Signal: `burst_or_short_term` | `sparse_low_signal`

**Layer 2 — Deployment readiness (independent of behavioral type):**

| Condition | needs_review_flag | deployment_readiness |
|-----------|------------------|----------------------|
| cluster_quality == needs_review | 1 | REVIEW_FIRST |
| needs_manual_review == 1 AND violations >= 5000 | 1 | REVIEW_FIRST |
| needs_manual_review == 1 | 1 | REVIEW_FIRST |
| otherwise | 0 | READY |

**Confidence rules:**

| Tier | Condition |
|------|-----------|
| HIGH | violations >= 100 AND active_days >= 14 AND (recurrence >= 0.15 OR top_day_share >= 0.25) |
| MEDIUM | violations >= 30 OR active_days >= 7 (and not HIGH) |
| LOW | all other cases |

---

## Summary Metrics

- **Clusters processed:** 1084
- **Total violations represented:** 259,138

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

**needs_review_flag distribution:**

| Flag | Clusters |
|------|----------|
| 0 | 496 |
| 1 | 588 |

**Classification confidence distribution:**

| Confidence | Clusters |
|------------|----------|
| HIGH | 240 |
| MEDIUM | 632 |
| LOW | 212 |

**Behavior signal strength distribution:**

| Strength | Clusters |
|----------|----------|
| HIGH | 240 |
| MEDIUM | 632 |
| LOW | 212 |

**Average active_days by hotspot type:**

| Type | Avg active_days | Avg recurrence_rate |
|------|----------------|---------------------|
| STRUCTURAL | 67.4 | 0.462 |
| RESPONSIVE | 12.1 | 0.154 |
| SEASONAL | 10.1 | 0.14 |

---

## Top 20 Classified Hotspots

| cluster_id | assigned_station | total_violations | hotspot_type | deployment_readiness | recommended_action | classification_confidence | review_reason |
|------------|-----------------|----------------|-------------|---------------------|-------------------|--------------------------|---------------|
| C_0_1 | UPPARPET | 23,553 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Cluster quality marked needs_review; verify e |
| C_27_0 | SHIVAJINAGAR | 17,825 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Cluster quality marked needs_review; verify e |
| C_0_0 | CITY MARKET | 10,667 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Cluster quality marked needs_review; verify e |
| C_22 | MALLESHWARAM | 9,096 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Large/high-density cluster; inspect before op |
| C_0_2 | UPPARPET | 8,323 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Large/high-density cluster; inspect before op |
| C_333 | HAL OLD AIRPORT | 7,154 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Large/high-density cluster; inspect before op |
| C_13 | MALLESHWARAM | 6,487 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Large/high-density cluster; inspect before op |
| C_20 | KODIGEHALLI | 5,251 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Large/high-density cluster; inspect before op |
| C_14 | SHIVAJINAGAR | 4,501 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_153 | VIJAYANAGARA | 4,474 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_171 | CHIKKAJALA | 4,437 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_3 | K.R. PURA | 3,926 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_15 | MALLESHWARAM | 3,813 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_41 | HEBBALA | 3,198 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_38 | HALASURU GATE | 3,040 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_39 | MALLESHWARAM | 2,928 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_327 | HIGH GROUND | 2,757 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_4 | VIJAYANAGARA | 2,677 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_54 | MAGADI ROAD | 2,407 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |
| C_81 | CITY MARKET | 2,187 | STRUCTURAL | REVIEW_FIRST | Review geography first; if confirmed, apply: Recurring patrol + towing | HIGH | Phase 2 manual review flag; verify geography  |

---

## Review-First Hotspots (Top 15)

These clusters have `deployment_readiness = REVIEW_FIRST` but still
carry a behavioral hotspot_type for pre-planning.

| cluster_id | assigned_station | total_violations | hotspot_type | classification_confidence | review_reason |
|------------|-----------------|----------------|-------------|--------------------------|---------------|
| C_0_1 | UPPARPET | 23,553 | STRUCTURAL | HIGH | Cluster quality marked needs_review; verify exact hotspot boundary |
| C_27_0 | SHIVAJINAGAR | 17,825 | STRUCTURAL | HIGH | Cluster quality marked needs_review; verify exact hotspot boundary |
| C_0_0 | CITY MARKET | 10,667 | STRUCTURAL | HIGH | Cluster quality marked needs_review; verify exact hotspot boundary |
| C_22 | MALLESHWARAM | 9,096 | STRUCTURAL | HIGH | Large/high-density cluster; inspect before operational use |
| C_0_2 | UPPARPET | 8,323 | STRUCTURAL | HIGH | Large/high-density cluster; inspect before operational use |
| C_333 | HAL OLD AIRPORT | 7,154 | STRUCTURAL | HIGH | Large/high-density cluster; inspect before operational use |
| C_13 | MALLESHWARAM | 6,487 | STRUCTURAL | HIGH | Large/high-density cluster; inspect before operational use |
| C_20 | KODIGEHALLI | 5,251 | STRUCTURAL | HIGH | Large/high-density cluster; inspect before operational use |
| C_14 | SHIVAJINAGAR | 4,501 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_153 | VIJAYANAGARA | 4,474 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_171 | CHIKKAJALA | 4,437 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_3 | K.R. PURA | 3,926 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_15 | MALLESHWARAM | 3,813 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_41 | HEBBALA | 3,198 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |
| C_38 | HALASURU GATE | 3,040 | STRUCTURAL | HIGH | Phase 2 manual review flag; verify geography before deployment |

---

## Ready Hotspots (Top 15)

These clusters have `deployment_readiness = READY` — cleared for direct enforcement.

| cluster_id | assigned_station | total_violations | hotspot_type | classification_confidence | m4_reason |
|------------|-----------------|----------------|-------------|--------------------------|-----------|
| C_731 | HAL OLD AIRPORT | 1,751 | STRUCTURAL | HIGH | active_days=70, active_weeks=18 [rule A: >=30 days AND >=8 weeks] |
| C_605 | BYATARAYANAPURA | 981 | RESPONSIVE | HIGH | default responsive; active_days=18, violations=981, rec_rate=0.188 |
| C_142 | BANASWADI | 818 | STRUCTURAL | HIGH | active_days=90, active_weeks=20 [rule A: >=30 days AND >=8 weeks] |
| C_292 | HSR LAYOUT | 684 | STRUCTURAL | HIGH | active_days=79, active_weeks=20 [rule A: >=30 days AND >=8 weeks] |
| C_403 | ASHOK NAGAR | 654 | STRUCTURAL | HIGH | active_days=41, active_weeks=17 [rule A: >=30 days AND >=8 weeks] |
| C_446 | ADUGODI | 571 | STRUCTURAL | HIGH | active_days=31, active_weeks=15 [rule A: >=30 days AND >=8 weeks] |
| C_1 | SHESHADRIPURAM | 512 | STRUCTURAL | HIGH | active_days=35, active_weeks=18 [rule A: >=30 days AND >=8 weeks] |
| C_167 | ASHOK NAGAR | 509 | STRUCTURAL | HIGH | active_days=54, active_weeks=18 [rule A: >=30 days AND >=8 weeks] |
| C_643 | HAL OLD AIRPORT | 441 | STRUCTURAL | HIGH | active_days=58, active_weeks=18 [rule A: >=30 days AND >=8 weeks] |
| C_139 | VIJAYANAGARA | 421 | STRUCTURAL | HIGH | active_days=43, active_weeks=19 [rule A: >=30 days AND >=8 weeks] |
| C_349 | MICO LAYOUT | 419 | STRUCTURAL | HIGH | active_days=35, active_weeks=13 [rule A: >=30 days AND >=8 weeks] |
| C_254 | HSR LAYOUT | 419 | STRUCTURAL | HIGH | active_days=54, active_weeks=20 [rule A: >=30 days AND >=8 weeks] |
| C_303 | MAHADEVAPURA | 413 | STRUCTURAL | HIGH | active_days=79, active_weeks=19 [rule A: >=30 days AND >=8 weeks] |
| C_319 | WILSON GARDEN | 386 | RESPONSIVE | MEDIUM | default responsive; active_days=22, violations=386, rec_rate=0.150 |
| C_631 | VIJAYANAGARA | 383 | STRUCTURAL | HIGH | active_days=43, active_weeks=19 [rule A: >=30 days AND >=8 weeks] |

---

## Structural Hotspots (Top 10)

| cluster_id | assigned_station | total_violations | active_days | recurrence_rate | deployment_readiness | classification_confidence |
|------------|-----------------|----------------|------------|-----------------|---------------------|--------------------------|
| C_0_1 | UPPARPET | 23,553 | 151 | 1.000 | REVIEW_FIRST | HIGH |
| C_27_0 | SHIVAJINAGAR | 17,825 | 151 | 1.000 | REVIEW_FIRST | HIGH |
| C_0_0 | CITY MARKET | 10,667 | 151 | 1.000 | REVIEW_FIRST | HIGH |
| C_22 | MALLESHWARAM | 9,096 | 151 | 1.000 | REVIEW_FIRST | HIGH |
| C_0_2 | UPPARPET | 8,323 | 151 | 1.000 | REVIEW_FIRST | HIGH |
| C_333 | HAL OLD AIRPORT | 7,154 | 95 | 0.655 | REVIEW_FIRST | HIGH |
| C_13 | MALLESHWARAM | 6,487 | 148 | 0.980 | REVIEW_FIRST | HIGH |
| C_20 | KODIGEHALLI | 5,251 | 127 | 0.841 | REVIEW_FIRST | HIGH |
| C_14 | SHIVAJINAGAR | 4,501 | 146 | 0.967 | REVIEW_FIRST | HIGH |
| C_153 | VIJAYANAGARA | 4,474 | 126 | 0.851 | REVIEW_FIRST | HIGH |

---

## Responsive Hotspots (Top 10)

| cluster_id | assigned_station | total_violations | top_day_share | active_days | deployment_readiness | classification_confidence |
|------------|-----------------|----------------|--------------|------------|---------------------|--------------------------|
| C_605 | BYATARAYANAPURA | 981 | 0.147 | 18 | READY | HIGH |
| C_319 | WILSON GARDEN | 386 | 0.137 | 22 | READY | MEDIUM |
| C_440 | BANASHANKARI | 298 | 0.178 | 29 | READY | HIGH |
| C_607 | MICO LAYOUT | 295 | 0.105 | 26 | READY | HIGH |
| C_844 | HAL OLD AIRPORT | 266 | 0.233 | 18 | READY | HIGH |
| C_652 | MAHADEVAPURA | 241 | 0.224 | 15 | READY | MEDIUM |
| C_808 | MADIWALA | 237 | 0.122 | 21 | READY | HIGH |
| C_88 | JALAHALLI | 233 | 0.077 | 24 | READY | HIGH |
| C_52 | RAJAJINAGAR | 223 | 0.341 | 17 | READY | HIGH |
| C_556 | ASHOK NAGAR | 213 | 0.291 | 13 | READY | MEDIUM |

---

## Seasonal Hotspots (Top 10)

| cluster_id | assigned_station | total_violations | weekend_share | active_days | deployment_readiness | classification_confidence |
|------------|-----------------|----------------|--------------|------------|---------------------|--------------------------|
| C_383 | K.G. HALLI | 266 | 0.474 | 26 | READY | HIGH |
| C_116 | YELAHANKA | 209 | 0.512 | 25 | READY | HIGH |
| C_531 | HALASURU GATE | 182 | 0.500 | 29 | READY | HIGH |
| C_587 | MAGADI ROAD | 173 | 0.653 | 21 | READY | HIGH |
| C_590 | YELAHANKA | 167 | 0.503 | 23 | READY | HIGH |
| C_63 | ASHOK NAGAR | 148 | 0.730 | 24 | READY | HIGH |
| C_0_33 | CITY MARKET | 139 | 0.590 | 21 | READY | HIGH |
| C_433 | SADASHIVANAGAR | 133 | 0.579 | 19 | READY | MEDIUM |
| C_121 | MALLESHWARAM | 128 | 0.492 | 27 | READY | HIGH |
| C_458 | BYATARAYANAPURA | 124 | 0.565 | 28 | READY | HIGH |

---

## Verification Checks

| Check | Status |
|-------|--------|
| output file exists | PASS |
| one row per cluster | PASS |
| cluster id unique | PASS |
| no noise rows | PASS |
| cluster ids match summary | PASS |
| no missing hotspot type | PASS |
| hotspot type only behavioral | PASS |
| needs review absent from htype | PASS |
| needs review flag valid | PASS |
| deployment readiness valid | PASS |
| review reason non null | PASS |
| recommended action non null | PASS |
| confidence values valid | PASS |
| m3 peak fields joined | PASS |
| m18 station joined | PASS |

---

## Limitations

- **Rule-based classifier, not trained supervised ML.**  No historical
  enforcement outcome labels exist (`action_taken_timestamp` and
  `closed_datetime` are fully NULL in the dataset).  Rules are calibrated
  on violation recurrence patterns only.
- **Review flag means geographic/operator inspection is required, not bad data.**
  The `needs_manual_review` flag was set broadly in Phase 2 for clusters
  warranting human inspection.  The behavioral classification is still valid
  and useful for pre-planning; only field deployment is gated.
- **Recurrence as proxy for structural behaviour.**  A cluster appearing
  on many days is classified STRUCTURAL, but this does not prove that
  enforcement actions were tried and failed.  It may simply be chronically
  under-patrolled.
- **Cannot prove enforcement effectiveness.**  `action_taken_timestamp` and
  `closed_datetime` are fully NULL — no enforcement outcome data exists to
  validate whether RESPONSIVE clusters actually respond to tow deployment.
- M3 and M18 joins add enrichment but are not required for Layer 1
  behavioral classification.  Core rules depend only on recurrence features
  from the handoff file.

---

## Final Recommendation

Corrected M4 outputs are ready to merge into Prakhar Phase 2.
The two-layer design (behavioral type + deployment readiness) is the correct
architecture for downstream use in M10 (VRP), M12 (Feedback), and the
scored_hotspots schema.  REVIEW_FIRST clusters can still be ranked and
pre-planned; they simply require operator sign-off before field deployment.
M3 peak fields joined.
M18 station fields joined.
