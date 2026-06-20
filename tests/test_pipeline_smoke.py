"""
Pipeline smoke tests

Purpose:
    Run each pipeline stage on a minimal fixture and assert that output files
    are created with the expected schema. These tests are intentionally light
    so they execute quickly during development.

Tests to add:
    - test_01_clean_produces_parquet
    - test_02_cluster_produces_clusters
    - test_03_jurisdiction_adds_station_columns
    - test_04_osm_enrichment_adds_road_columns
    - test_05_score_produces_scored_hotspots
    - test_06_vrp_produces_routes
    - test_07_validation_metrics_exist

Owner:
    Shared backend QA.
"""

# TODO: implement smoke tests once fixtures are available
