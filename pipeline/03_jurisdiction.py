"""
Stage M18 — Jurisdiction Scoping (backend half)

Purpose:
    Assign each cluster centroid to a police station and flag border hotspots
    that sit near station boundaries. If official station polygons are
    unavailable, approximate each station's area from the convex hull of its
    tagged violations.

Inputs:
    data/processed/clustered_violations.parquet

Outputs:
    Adds `assigned_station` and `border_flag` columns to the cluster table.

Key transformations:
    - Load or build station polygons (GeoJSON or convex-hull approximation).
    - Use geopandas.sjoin to map cluster centroids to polygons.
    - Apply a 200m buffer to detect border_flag = 1 hotspots.

Owner:
    Prakhar — Classification, Geography & Ops Layer.
"""

# TODO: implement M18 jurisdiction scoping logic
