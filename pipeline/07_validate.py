"""
Stage Validation — Scientific Credibility Metrics

Purpose:
    Compute offline validation metrics that demonstrate the pipeline is stable,
    actionable, and not merely re-ranking by violation count.

Inputs:
    data/outputs/scored_hotspots.parquet
    data/processed/enriched_clusters.parquet

Outputs:
    Printed / saved metrics report (e.g. data/outputs/validation_report.json).

Key metrics:
    - Hotspot stability: overlap % of top-20 hotspots between first 70% and
      last 30% of the time window.
    - Precision@K: temporal-split prediction quality at top-K.
    - ROI-vs-count divergence: Spearman correlation (target ~0.4-0.6).
    - OSM coverage rate.
    - Optional overlap with BTP's 154 hotspot list if available.

Owner:
    Prakhar — Classification, Geography & Ops Layer.
"""

# TODO: implement validation script
