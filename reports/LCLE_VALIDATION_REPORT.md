# LCLE Validation Report

## Methodology
LCLE estimates lane-capacity loss caused by illegal parking, not raw violation count.

### Formula
```
daily_violation_rate = violation_count / max(active_days, 1)
occupancy_proxy      = log1p(daily_violation_rate)
weighted_avg_vehicle_width = Σ(count × footprint) / Σ(count)
raw_block            = occupancy_proxy × weighted_avg_vehicle_width
obstruction          = 1.5 if junction_flag_rate > 0.5 else 1.0
lcle_pct             = min(100, (raw_block / max(road_width_m, 1)) × obstruction × 100)
```

### Confidence rules
- HIGH: real OSM width/lanes and cluster_quality != needs_review
- MEDIUM: IRC default width and cluster_quality != needs_review
- LOW: cluster_quality == needs_review

## LCLE distribution
- Mean LCLE: 40.53%
- Median LCLE: 35.22%
- Min LCLE: 6.79%
- Max LCLE: 100.00%

### Bucketed distribution
| LCLE range | count | % |
|------------|-------|---|
| [0, 10) | 8 | 0.7% |
| [10, 20) | 97 | 8.9% |
| [20, 30) | 291 | 26.8% |
| [30, 40) | 244 | 22.5% |
| [40, 50) | 176 | 16.2% |
| [50, 60) | 98 | 9.0% |
| [60, 70) | 61 | 5.6% |
| [70, 80) | 39 | 3.6% |
| [80, 90) | 26 | 2.4% |
| [90, 100) | 14 | 1.3% |

## Confidence distribution
| confidence | count | % |
|------------|-------|---|
| MEDIUM | 560 | 51.7% |
| HIGH | 490 | 45.2% |
| LOW | 34 | 3.1% |

## Road width source distribution
| source | count | % |
|--------|-------|---|
| irc_default | 583 | 53.8% |
| osm_width | 501 | 46.2% |

## Top 20 clusters by LCLE

| rank | cluster_id | violation_count | road_class | road_width_m | source | avg_width | occupancy | raw_block | junction_rate | lcle_pct | confidence |
|------|------------|-----------------|------------|--------------|--------|-----------|-----------|-----------|---------------|----------|------------|
| 1 | C_0_53 | 11 | residential | 3.5 | irc_default | 1.55 | 2.48 | 3.84 | 0.00 | 100.00 | LOW |
| 2 | C_731 | 1,751 | residential | 3.5 | irc_default | 1.53 | 3.26 | 4.98 | 0.00 | 100.00 | MEDIUM |
| 3 | C_81 | 2,187 | tertiary | 4.0 | irc_default | 1.48 | 2.84 | 4.20 | 0.00 | 100.00 | MEDIUM |
| 4 | C_908 | 15 | tertiary | 4.0 | irc_default | 1.86 | 2.77 | 5.16 | 0.00 | 100.00 | MEDIUM |
| 5 | C_972 | 15 | secondary | 5.5 | irc_default | 2.07 | 2.77 | 5.73 | 0.00 | 100.00 | MEDIUM |
| 6 | C_1017 | 16 | residential | 3.5 | irc_default | 1.54 | 2.83 | 4.37 | 0.00 | 100.00 | MEDIUM |
| 7 | C_798 | 16 | residential | 3.5 | irc_default | 1.82 | 2.20 | 4.00 | 0.00 | 100.00 | MEDIUM |
| 8 | C_1000 | 16 | residential | 3.5 | irc_default | 1.44 | 2.83 | 4.07 | 0.00 | 100.00 | MEDIUM |
| 9 | C_806 | 20 | residential | 3.5 | irc_default | 1.75 | 2.04 | 3.55 | 0.00 | 100.00 | MEDIUM |
| 10 | C_1004 | 19 | residential | 3.5 | irc_default | 2.05 | 1.99 | 4.08 | 0.00 | 100.00 | MEDIUM |
| 11 | C_282 | 20 | residential | 3.5 | irc_default | 1.78 | 3.04 | 5.40 | 0.00 | 100.00 | MEDIUM |
| 12 | C_1018 | 17 | residential | 3.5 | irc_default | 1.32 | 2.89 | 3.83 | 0.00 | 100.00 | MEDIUM |
| 13 | C_83 | 1,240 | tertiary | 4.0 | irc_default | 1.76 | 2.58 | 4.54 | 0.00 | 100.00 | MEDIUM |
| 14 | C_696 | 28 | trunk_link | 3.5 | irc_default | 2.13 | 1.73 | 3.70 | 0.00 | 100.00 | MEDIUM |
| 15 | C_17 | 927 | residential | 3.5 | irc_default | 1.79 | 2.37 | 4.24 | 0.01 | 100.00 | MEDIUM |
| 16 | C_126 | 939 | trunk_link | 3.0 | osm_width | 1.65 | 2.49 | 4.11 | 0.12 | 100.00 | HIGH |
| 17 | C_14 | 4,501 | tertiary | 4.0 | irc_default | 1.44 | 3.46 | 4.97 | 0.00 | 100.00 | MEDIUM |
| 18 | C_0_2 | 8,323 | residential | 3.5 | irc_default | 1.13 | 4.03 | 4.54 | 0.00 | 100.00 | MEDIUM |
| 19 | C_3 | 3,926 | residential | 3.5 | irc_default | 1.36 | 3.30 | 4.50 | 0.00 | 100.00 | MEDIUM |
| 20 | C_171 | 4,437 | residential | 3.5 | irc_default | 1.90 | 3.46 | 6.56 | 0.02 | 100.00 | MEDIUM |

## Top 20 clusters by violation_count (for divergence check)

| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct |
|------|------------|-----------------|------------|--------------|----------|
| 1 | C_0_1 | 23,553 | tertiary | 6.0 | 100.00 |
| 2 | C_27_0 | 17,825 | tertiary | 6.0 | 96.95 |
| 3 | C_0_0 | 10,667 | primary | 7.0 | 75.62 |
| 4 | C_22 | 9,096 | secondary | 6.5 | 91.13 |
| 5 | C_0_2 | 8,323 | residential | 3.5 | 100.00 |
| 6 | C_333 | 7,154 | primary | 7.0 | 51.88 |
| 7 | C_13 | 6,487 | tertiary | 6.0 | 69.37 |
| 8 | C_20 | 5,251 | secondary | 9.0 | 33.86 |
| 9 | C_14 | 4,501 | tertiary | 4.0 | 100.00 |
| 10 | C_153 | 4,474 | primary | 7.0 | 39.33 |
| 11 | C_171 | 4,437 | residential | 3.5 | 100.00 |
| 12 | C_3 | 3,926 | residential | 3.5 | 100.00 |
| 13 | C_15 | 3,813 | residential | 3.5 | 100.00 |
| 14 | C_41 | 3,198 | tertiary | 9.0 | 38.42 |
| 15 | C_38 | 3,040 | secondary | 5.5 | 61.90 |
| 16 | C_39 | 2,928 | primary | 7.0 | 60.87 |
| 17 | C_327 | 2,757 | residential | 3.5 | 77.17 |
| 18 | C_4 | 2,677 | secondary | 5.5 | 62.41 |
| 19 | C_54 | 2,407 | residential | 3.5 | 67.57 |
| 20 | C_81 | 2,187 | tertiary | 4.0 | 100.00 |

## Checks
- LCLE range 0–100: PASS (min=6.79, max=100.00)
- Top-LCLE diverges from top-count: PASS

## Limitations
- LCLE uses an occupancy proxy (log1p of daily violation rate) because true dwell time of each illegally parked vehicle is unknown.
- Vehicle footprint is a fixed average width per vehicle class; actual parked positioning (parallel, angled, double-parked) is not modeled.
- Road width confidence is lower when IRC defaults are used (53.8% of clusters in this run).
- Junction obstruction is a binary 1.5× multiplier based on junction_flag_rate > 0.5.

## Final verdict: PASS