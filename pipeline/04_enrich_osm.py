"""
Stage P4 — OSM Enrichment

Purpose:
    Download Bengaluru's drivable road network from OpenStreetMap once, save it
    to disk, snap each cluster centroid to the nearest road edge, and attach
    road class and width attributes. Missing widths are filled from IRC
    defaults.

Inputs:
    data/processed/clustered_violations.parquet

Outputs:
    data/processed/enriched_clusters.parquet
    references/bengaluru_drive.graphml

Key transformations:
    - Download drive network with osmnx.graph_from_place.
    - Persist graph to references/bengaluru_drive.graphml.
    - Snap centroids with ox.distance.nearest_edges.
    - Read highway class and width tags; fallback to IRC defaults.
    - Record osm_coverage flag (1 = real OSM width, 0 = IRC default).

Owner:
    Piyush — Core ROI Pipeline spine.
"""

# TODO: implement P4 OSM enrichment logic
