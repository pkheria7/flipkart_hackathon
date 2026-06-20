# BCI Validation Report

## Methodology
BCI (Betweenness Centrality Index) estimates how critical a road segment is to the drivable network.

### Formula
```
node_betweenness   = approximate betweenness centrality of each OSM node (k=200 sampling)
edge_betweenness   = (node_betweenness[u] + node_betweenness[v]) / 2
alt_routes_proxy   = count of other edge midpoints within 200m
edge_betweenness_norm = min-max normalize(edge_betweenness)
alt_routes_norm  = min-max normalize(alt_routes_proxy)
bci = normalize(edge_betweenness_norm / (1 + alt_routes_norm))
```

## BCI distribution
- Mean BCI: 0.0463
- Median BCI: 0.0081
- Std BCI: 0.1136
- Min BCI: 0.0000
- Max BCI: 1.0000

## Top 20 clusters by BCI

| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | edge_betweenness_norm | alt_routes_norm | bci |
|------|------------|-----------------|------------|--------------|----------|----------------------|-----------------|-----|
| 1 | C_112 | 319 | trunk | 7.0 | 27.14 | 0.9396 | 0.0316 | 1.0000 |
| 2 | C_380 | 82 | trunk | 7.0 | 23.71 | 0.9396 | 0.0316 | 1.0000 |
| 3 | C_293 | 114 | trunk | 10.5 | 24.11 | 0.9685 | 0.0791 | 0.9854 |
| 4 | C_693 | 56 | trunk | 10.5 | 23.52 | 0.9277 | 0.0475 | 0.9724 |
| 5 | C_149 | 1,807 | trunk | 10.5 | 40.32 | 0.9172 | 0.1519 | 0.8742 |
| 6 | C_183 | 509 | trunk | 10.5 | 23.54 | 0.7962 | 0.0538 | 0.8296 |
| 7 | C_276 | 47 | trunk | 10.5 | 30.11 | 0.6746 | 0.0127 | 0.7314 |
| 8 | C_294 | 42 | trunk | 10.5 | 21.71 | 0.6746 | 0.0127 | 0.7314 |
| 9 | C_432 | 27 | trunk | 10.5 | 15.17 | 0.7027 | 0.0823 | 0.7129 |
| 10 | C_876 | 30 | trunk | 10.5 | 28.00 | 0.6459 | 0.0158 | 0.6981 |
| 11 | C_298 | 1,409 | trunk | 10.5 | 50.94 | 0.6996 | 0.1108 | 0.6915 |
| 12 | C_245 | 535 | trunk | 10.5 | 34.22 | 1.0000 | 0.5949 | 0.6884 |
| 13 | C_430 | 23 | trunk | 10.5 | 24.90 | 0.6524 | 0.0475 | 0.6839 |
| 14 | C_102 | 142 | trunk | 10.5 | 25.68 | 0.8517 | 0.4019 | 0.6670 |
| 15 | C_303 | 413 | trunk | 10.5 | 29.98 | 0.6411 | 0.1139 | 0.6320 |
| 16 | C_104 | 1,090 | trunk | 10.5 | 44.95 | 0.7181 | 0.2595 | 0.6260 |
| 17 | C_565 | 33 | trunk | 10.5 | 54.96 | 0.6546 | 0.2911 | 0.5567 |
| 18 | C_78 | 22 | secondary | 6.5 | 36.08 | 0.5498 | 0.0854 | 0.5561 |
| 19 | C_199 | 1,874 | trunk | 10.5 | 44.31 | 0.5772 | 0.1930 | 0.5312 |
| 20 | C_2 | 129 | trunk | 10.5 | 22.40 | 0.5892 | 0.2278 | 0.5269 |

### Road-class distribution in top 20 BCI
- trunk: 19
- secondary: 1

## Top 20 clusters by violation_count (for divergence check)

| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | bci |
|------|------------|-----------------|------------|--------------|----------|-----|
| 1 | C_0_1 | 23,553 | tertiary | 6.0 | 100.00 | 0.0000 |
| 2 | C_27_0 | 17,825 | tertiary | 6.0 | 96.95 | 0.0021 |
| 3 | C_0_0 | 10,667 | primary | 7.0 | 75.62 | 0.1175 |
| 4 | C_22 | 9,096 | secondary | 6.5 | 91.13 | 0.1407 |
| 5 | C_0_2 | 8,323 | residential | 3.5 | 100.00 | 0.0003 |
| 6 | C_333 | 7,154 | primary | 7.0 | 51.88 | 0.0000 |
| 7 | C_13 | 6,487 | tertiary | 6.0 | 69.37 | 0.0002 |
| 8 | C_20 | 5,251 | secondary | 9.0 | 33.86 | 0.0850 |
| 9 | C_14 | 4,501 | tertiary | 4.0 | 100.00 | 0.0386 |
| 10 | C_153 | 4,474 | primary | 7.0 | 39.33 | 0.0123 |
| 11 | C_171 | 4,437 | residential | 3.5 | 100.00 | 0.0005 |
| 12 | C_3 | 3,926 | residential | 3.5 | 100.00 | 0.0584 |
| 13 | C_15 | 3,813 | residential | 3.5 | 100.00 | 0.0263 |
| 14 | C_41 | 3,198 | tertiary | 9.0 | 38.42 | 0.0738 |
| 15 | C_38 | 3,040 | secondary | 5.5 | 61.90 | 0.0752 |
| 16 | C_39 | 2,928 | primary | 7.0 | 60.87 | 0.0075 |
| 17 | C_327 | 2,757 | residential | 3.5 | 77.17 | 0.0091 |
| 18 | C_4 | 2,677 | secondary | 5.5 | 62.41 | 0.0045 |
| 19 | C_54 | 2,407 | residential | 3.5 | 67.57 | 0.0023 |
| 20 | C_81 | 2,187 | tertiary | 4.0 | 100.00 | 0.0001 |

## Low-count / high-BCI demo beat
- Top-10% BCI threshold: 0.1113
- Clusters in bottom 25% violation_count AND top 10% BCI: **15**

| cluster_id | violation_count | road_class | bci |
|------------|-----------------|------------|-----|
| C_883 | 10 | tertiary | 0.2690 |
| C_1015 | 7 | tertiary | 0.1202 |
| C_689 | 20 | trunk | 0.2012 |
| C_835 | 17 | secondary | 0.1222 |
| C_762 | 15 | tertiary | 0.1426 |
| C_691 | 16 | primary | 0.1654 |
| C_829 | 17 | primary | 0.1204 |
| C_656 | 18 | primary | 0.2455 |
| C_802 | 18 | trunk | 0.5025 |
| C_789 | 20 | primary | 0.1541 |

## Checks
- BCI range [0, 1]: PASS
- BCI spread > 0.001: PASS (std=0.1136)
- BCI diverges from violation_count: PASS
- Low-count / high-BCI demo beat exists: PASS

## Limitations
- Node betweenness is sampled (k=200) to keep computation tractable on a 155k-node graph.
- Alternative routes are approximated by nearby edge count, not actual route redundancy.
- Edge betweenness is approximated by averaging endpoint node betweenness.

## Final verdict: PASS