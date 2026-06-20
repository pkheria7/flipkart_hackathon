# Phase 2 Merge Report

This report documents the Gate 2 merge: joining Piyush's geospatial/LCLE/BCI output with Prakhar's Phase 2 features into the scored_hotspots contract table.

## Join summary
- Input enriched clusters: 1,084 rows
- Output rows: 1,084
- Schema columns: 18

## Column source map

| schema_column | source | null_count | status |
|---------------|--------|------------|--------|
| cluster_id | Piyush/enriched_clusters | 0 | OK |
| centroid_lat | Piyush/enriched_clusters | 0 | OK |
| centroid_lng | Piyush/enriched_clusters | 0 | OK |
| assigned_station | Prakhar/assigned_station | 0 | OK |
| border_flag | derived in M1 | 0 | OK |
| road_class | Piyush/enriched_clusters | 0 | OK |
| road_width_m | Piyush/enriched_clusters | 0 | OK |
| osm_coverage | Piyush/enriched_clusters | 0 | OK |
| violation_count | Piyush/enriched_clusters | 0 | OK |
| vehicle_mix | Piyush/enriched_clusters | 0 | OK |
| lcle_pct | Piyush/enriched_clusters | 0 | OK |
| bci | Piyush/enriched_clusters | 0 | OK |
| persistence | derived in M1 | 0 | OK |
| recurrence | derived in M1 | 0 | OK |
| peak_window | derived in M1 | 0 | OK |
| roi_score | derived in M1 | 0 | OK |
| classification | Prakhar/hotspot_type | 0 | OK |
| recommended_action | Prakhar/recommended_action | 0 | OK |

## Validation checks
- All schema columns present: PASS
- No duplicate cluster_id rows: PASS
- No NOISE rows: PASS
- roi_score in [0, 100]: PASS

## Stubbed columns
- `border_flag`: stubbed because the upstream module did not produce it.

## Notes
- `border_flag` should ideally come from M18 jurisdiction scoping. Prakhar's current output does not include it, so it is set to 0 for all clusters.
- `assigned_station` comes from Prakhar's M18 jurisdiction output.
- `classification` and `recommended_action` come from Prakhar's M4 classifier output.
- `persistence`, `recurrence`, `peak_window` are derived from Prakhar's M3 peak-window output.