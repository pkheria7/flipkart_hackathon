"""
Stage M1/M2 — LCLE + ROI Ranker

Purpose:
    Compute the Lane-Clearance-Likelihood Estimate (LCLE) for each cluster,
    merge Prakhar's persistence/peak-window columns, and produce a final
    ROI score. BCI is stubbed at 1.0 until Phase 3, then replaced by the real
    betweenness centrality index.

Inputs:
    data/processed/enriched_clusters.parquet
    data/processed/clustered_violations.parquet (for peak/persistence merge)
    data/outputs/feedback.sqlite (Phase 4 — feedback-aware re-run)

Outputs:
    data/outputs/scored_hotspots.parquet

Key transformations:
    - Compute raw_block from vehicle footprint weights.
    - Apply junction obstruction multiplier.
    - LCLE% = min(100, raw_block / road_width_m * obstruction * 100).
    - ROI = (lcle_pct * traffic_weight * persistence * bci) / officer_hours.
    - Normalize ROI to 0-100.
    - Phase 4: read feedback.sqlite and push "enforced but recurred"
      clusters toward STRUCTURAL classification.

Owner:
    Piyush — Core ROI Pipeline spine (M2 + M1).
"""

# TODO: implement M2 LCLE and M1 ROI scoring logic
