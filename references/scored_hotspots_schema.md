# Data Contract — scored_hotspots

This file is the locked interface between the pipeline and any consumer.
Neither side changes these columns without telling the other.

| Column | Type | Description |
|---|---|---|
| cluster_id | str | Unique cluster identifier |
| centroid_lat | float | Cluster centroid latitude |
| centroid_lng | float | Cluster centroid longitude |
| assigned_station | str | Police station assigned by jurisdiction scoping |
| border_flag | int (0/1) | 1 if centroid is within ~200m of a station boundary |
| road_class | str | OSM highway class (primary, secondary, ...) |
| road_width_m | float | Road width in metres (OSM real or IRC default) |
| osm_coverage | int (1/0) | 1 = real OSM width, 0 = IRC default |
| violation_count | int | Number of violations in the cluster |
| vehicle_mix | str | e.g. "BUS:3,CAR:12,SCOOTER:40" |
| lcle_pct | float (0-100) | Lane-clearance likelihood estimate |
| bci | float (0-1) | Betweenness centrality index (stubbed 1.0 until Phase 3) |
| persistence | float | Mean violations/hour inside the peak window |
| recurrence | float (0-1) | Fraction of weeks above recurrence threshold |
| peak_window | str | e.g. "Mon-Fri 08:00-10:00" |
| roi_score | float (0-100) | Final ROI ranking score |
| classification | str | STRUCTURAL / RESPONSIVE |
| recommended_action | str | TOW / WARNING / BARRIER |
