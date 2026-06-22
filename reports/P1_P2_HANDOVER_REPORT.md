# P1 + P2 Handover Report

## Pipeline run summary
- Raw rows: 298,450
- Cleaned rows: 298,277
- Dropped rows: 173
- Clustered rows: 259,138
- Noise rows: 39,139
- Number of clusters: 1,084

## Cluster size statistics
- Average size: 239.1
- Median size: 36.0
- Largest cluster: 23,553 violations
- Smallest cluster: 3 violations

## Cluster quality distribution
- medium: 792
- good: 258
- needs_review: 34

## Oversized Cluster Split Summary

Oversized clusters were re-clustered with tighter DBSCAN parameters to produce block/intersection-level subclusters.

| old_cluster_id | old_count | old_h3_cells | subclusters | largest_subcluster | new_noise | eps | min_samples |
|----------------|-----------|--------------|-------------|--------------------|-----------|-----|-------------|
| C_0 | 51,168 | 24 | 56 | 23,553 | 1,049 | 10.0m | 10 |
| C_27 | 18,528 | 9 | 11 | 17,825 | 275 | 10.0m | 10 |

- Total violations re-clustered: 69,696
- Total subclusters created: 67
- Total new noise rows from splits: 1,324
- Final subclustering parameters: eps=10.0m, min_samples=10, metric=haversine.

## Top 20 clusters by violation_count

| Rank | cluster_id | centroid_lat | centroid_lng | count | dominant_vehicle | police_station_mode | quality |
|------|------------|--------------|--------------|-------|------------------|---------------------|---------|
| 1 | C_0_1 | 12.977404 | 77.577330 | 23553 | CAR | UPPARPET | needs_review |
| 2 | C_27_0 | 12.981532 | 77.609128 | 17825 | SCOOTER | SHIVAJINAGAR | needs_review |
| 3 | C_0_0 | 12.964367 | 77.576704 | 10667 | SCOOTER | CITY MARKET | needs_review |
| 4 | C_22 | 13.010572 | 77.553882 | 9096 | CAR | MALLESHWARAM | good |
| 5 | C_0_2 | 12.972447 | 77.578088 | 8323 | SCOOTER | UPPARPET | good |
| 6 | C_333 | 12.933670 | 77.690943 | 7154 | SCOOTER | HAL OLD AIRPORT | good |
| 7 | C_13 | 12.999707 | 77.550373 | 6487 | SCOOTER | MALLESHWARAM | good |
| 8 | C_20 | 13.071059 | 77.587936 | 5251 | SCOOTER | KODIGEHALLI | good |
| 9 | C_14 | 12.983489 | 77.603289 | 4501 | PASSENGER AUTO | SHIVAJINAGAR | good |
| 10 | C_153 | 12.974362 | 77.545640 | 4474 | SCOOTER | VIJAYANAGARA | good |
| 11 | C_171 | 13.185431 | 77.679948 | 4437 | CAR | CHIKKAJALA | good |
| 12 | C_3 | 13.008460 | 77.695454 | 3926 | SCOOTER | K.R. PURA | good |
| 13 | C_15 | 13.006735 | 77.570565 | 3813 | CAR | MALLESHWARAM | good |
| 14 | C_41 | 13.035301 | 77.589024 | 3198 | SCOOTER | HEBBALA | good |
| 15 | C_38 | 12.964582 | 77.583898 | 3040 | SCOOTER | HALASURU GATE | good |
| 16 | C_39 | 12.998021 | 77.571358 | 2928 | CAR | MALLESHWARAM | good |
| 17 | C_327 | 12.992657 | 77.588875 | 2757 | SCOOTER | HIGH GROUND | good |
| 18 | C_4 | 12.965155 | 77.538115 | 2677 | SCOOTER | VIJAYANAGARA | good |
| 19 | C_54 | 12.973571 | 77.551130 | 2407 | SCOOTER | MAGADI ROAD | good |
| 20 | C_81 | 12.959680 | 77.577068 | 2187 | SCOOTER | CITY MARKET | good |

## Handover instructions for Prakhar

### For M3 Peak Window and M4 Recurrence
Use **row-level** file:
- `C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\processed\cluster_handoff_for_prakhar.parquet`
- `C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\processed\cluster_handoff_for_prakhar.csv`

Key columns already provided:
`cluster_id`, `created_datetime_ist`, `date_ist`, `hour`, `day_of_week`, `day_name`, `week_number`, `month`, `vehicle_type_final`, `junction_flag`, `police_station_clean`, `h3_res9`

### For M18 Jurisdiction Scoping and cluster-level merging
Use **cluster-level** file:
- `C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\processed\cluster_summary.parquet`
- `C:\Users\Prakhar Parashar\Documents\GRID_HACKATHON\flipkart_hackathon\data\processed\cluster_summary.csv`

Key columns:
`cluster_id`, `centroid_lat`, `centroid_lng`, `violation_count`, `police_station_mode`, `location_mode`, `vehicle_mix`, `junction_flag_rate`, `h3_cells_count`

### Join rule
Join all future outputs on `cluster_id`. Noise rows keep `cluster_id='NOISE'` and should be excluded from cluster-level analysis.

## DBSCAN tuning note
- Global parameters: eps=20.0m, min_samples=15.
- Oversized clusters re-clustered with: eps=10.0m, min_samples=10.
- Initial plan suggested 150m, but that merged entire neighborhoods into mega-clusters.
- Tuning rationale: reduce eps until dense commercial areas resolve into block/intersection-level hotspots.
- If downstream modules see too many tiny clusters or too much noise, tune these values and re-run `pipeline/run_phase1.py`.