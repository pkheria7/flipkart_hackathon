# M1 ROI Validation Report

## Methodology
ROI score ranks clusters by expected enforcement impact, not raw violation count.

### Formula
```
persistence  = peak_hour_count / 2.0   (violations per hour in 2-hr peak window)
recurrence   = active_weeks / max(active_weeks)
raw_roi      = (lcle_pct * road_traffic_weight * persistence * bci * recurrence) / officer_hours
roi_score    = rank_pct(raw_roi) * 100   (percentile-rank spread; raw ROI is heavily skewed by BCI)
```

## ROI distribution
- Mean ROI: 50.05
- Median ROI: 50.05
- Std ROI: 28.88
- Min ROI: 0.3690
- Max ROI: 100.0000

## Top 20 clusters by ROI

| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | bci | persistence | recurrence | roi_score |
|------|------------|-----------------|------------|--------------|----------|-----|-------------|------------|-----------|
| 1 | C_298 | 1,409 | trunk | 10.5 | 50.94 | 0.6915 | 239.00 | 0.9130 | 100.0000 |
| 2 | C_0_0 | 10,667 | primary | 7.0 | 75.62 | 0.1175 | 742.00 | 1.0000 | 99.9077 |
| 3 | C_22 | 9,096 | secondary | 6.5 | 91.13 | 0.1407 | 728.00 | 1.0000 | 99.8155 |
| 4 | C_149 | 1,807 | trunk | 10.5 | 40.32 | 0.8742 | 161.00 | 1.0000 | 99.7232 |
| 5 | C_199 | 1,874 | trunk | 10.5 | 44.31 | 0.5312 | 225.00 | 0.9565 | 99.6310 |
| 6 | C_126 | 939 | trunk_link | 3.0 | 100.00 | 0.3813 | 152.00 | 0.9565 | 99.5387 |
| 7 | C_104 | 1,090 | trunk | 10.5 | 44.95 | 0.6260 | 108.50 | 0.9565 | 99.4465 |
| 8 | C_18 | 1,602 | trunk | 7.0 | 45.13 | 0.2736 | 128.00 | 1.0000 | 99.3542 |
| 9 | C_229 | 1,139 | primary | 10.5 | 38.91 | 0.1949 | 191.50 | 1.0000 | 99.2620 |
| 10 | C_245 | 535 | trunk | 10.5 | 34.22 | 0.6884 | 58.50 | 1.0000 | 99.1697 |
| 11 | C_20 | 5,251 | secondary | 9.0 | 33.86 | 0.0850 | 646.00 | 1.0000 | 99.0775 |
| 12 | C_58 | 1,253 | primary | 10.5 | 39.94 | 0.1704 | 143.50 | 1.0000 | 98.9852 |
| 13 | C_38 | 3,040 | secondary | 5.5 | 61.90 | 0.0752 | 298.50 | 1.0000 | 98.8930 |
| 14 | C_261 | 665 | tertiary | 4.0 | 70.96 | 0.1733 | 149.00 | 0.9565 | 98.8007 |
| 15 | C_183 | 509 | trunk | 10.5 | 23.54 | 0.8296 | 44.00 | 0.9565 | 98.7085 |
| 16 | C_3 | 3,926 | residential | 3.5 | 100.00 | 0.0584 | 469.00 | 1.0000 | 98.6162 |
| 17 | C_14 | 4,501 | tertiary | 4.0 | 100.00 | 0.0386 | 331.00 | 1.0000 | 98.5240 |
| 18 | C_112 | 319 | trunk | 7.0 | 27.14 | 1.0000 | 26.50 | 0.8696 | 98.4317 |
| 19 | C_303 | 413 | trunk | 10.5 | 29.98 | 0.6320 | 39.50 | 0.8261 | 98.3395 |
| 20 | C_177 | 341 | trunk | 10.5 | 25.21 | 0.3416 | 56.50 | 1.0000 | 98.2472 |

### Road-class distribution in top 20 ROI
- trunk: 10
- primary: 3
- secondary: 3
- tertiary: 2
- trunk_link: 1
- residential: 1

## Top 20 clusters by violation_count (for divergence check)

| rank | cluster_id | violation_count | road_class | lcle_pct | bci | roi_score |
|------|------------|-----------------|------------|----------|-----|-----------|
| 1 | C_0_1 | 23,553 | tertiary | 100.00 | 0.0000 | 74.7232 |
| 2 | C_27_0 | 17,825 | tertiary | 96.95 | 0.0021 | 97.2325 |
| 3 | C_0_0 | 10,667 | primary | 75.62 | 0.1175 | 99.9077 |
| 4 | C_22 | 9,096 | secondary | 91.13 | 0.1407 | 99.8155 |
| 5 | C_0_2 | 8,323 | residential | 100.00 | 0.0003 | 79.1513 |
| 6 | C_333 | 7,154 | primary | 51.88 | 0.0000 | 50.5535 |
| 7 | C_13 | 6,487 | tertiary | 69.37 | 0.0002 | 74.8155 |
| 8 | C_20 | 5,251 | secondary | 33.86 | 0.0850 | 99.0775 |
| 9 | C_14 | 4,501 | tertiary | 100.00 | 0.0386 | 98.5240 |
| 10 | C_153 | 4,474 | primary | 39.33 | 0.0123 | 96.8635 |
| 11 | C_171 | 4,437 | residential | 100.00 | 0.0005 | 75.2768 |
| 12 | C_3 | 3,926 | residential | 100.00 | 0.0584 | 98.6162 |
| 13 | C_15 | 3,813 | residential | 100.00 | 0.0263 | 97.0480 |
| 14 | C_41 | 3,198 | tertiary | 38.42 | 0.0738 | 97.7860 |
| 15 | C_38 | 3,040 | secondary | 61.90 | 0.0752 | 98.8930 |
| 16 | C_39 | 2,928 | primary | 60.87 | 0.0075 | 95.9410 |
| 17 | C_327 | 2,757 | residential | 77.17 | 0.0091 | 94.4649 |
| 18 | C_4 | 2,677 | secondary | 62.41 | 0.0045 | 93.1734 |
| 19 | C_54 | 2,407 | residential | 67.57 | 0.0023 | 85.0554 |
| 20 | C_81 | 2,187 | tertiary | 100.00 | 0.0001 | 56.4576 |

## Low-count / high-ROI demo beat
- Definition: violation_count <= median AND roi_score >= top 20%
- ROI threshold (top 20%): 80.02
- Clusters below-median count AND top-20% ROI: **19**

| cluster_id | violation_count | road_class | roi_score |
|------------|-----------------|------------|-----------|
| C_696 | 28 | trunk_link | 90.8672 |
| C_863 | 32 | tertiary | 82.9336 |
| C_565 | 33 | trunk | 85.7011 |
| C_577 | 30 | tertiary | 82.2878 |
| C_689 | 20 | trunk | 81.2731 |
| C_78 | 22 | secondary | 90.9594 |
| C_462 | 23 | tertiary | 80.9963 |
| C_876 | 30 | trunk | 92.6199 |
| C_422 | 25 | primary | 84.5018 |
| C_788 | 22 | primary | 82.5646 |

## Checks
- ROI range [0, 100]: PASS
- ROI spread > 0.001: PASS (std=28.8808)
- ROI diverges from violation_count: PASS
- Low-count / high-ROI demo beat exists: PASS

## Limitations
- `border_flag` is stubbed to 0 because Prakhar's M18 output does not yet include an explicit boundary flag.
- BCI is used as-is from the existing M7 computation; it is heavily skewed toward trunk roads.
- Officer hours are modeled as a constant 2.0 hours per cluster.

## Final verdict: PASS