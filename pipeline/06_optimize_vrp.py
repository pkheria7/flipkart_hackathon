"""
Stage M10 — VRP Optimizer

Purpose:
    Build patrol routes for each police station using a Team-Orienteering
    formulation: maximize collected ROI within a time budget while allowing
    low-value distant hotspots to be skipped. Routes are computed on the saved
    road graph.

Inputs:
    data/outputs/scored_hotspots.parquet
    references/bengaluru_drive.graphml

Outputs:
    data/outputs/patrol_routes.json

Key transformations:
    - Select top-N ROI clusters for one station + depot.
    - Compute shortest-path travel-time matrix on the saved graph.
    - Solve with OR-Tools routing: K vehicles, per-route time budget,
      maximize reward, skip allowed.
    - Emit ordered stops per truck with ETAs.

Owner:
    Prakhar — Classification, Geography & Ops Layer.
"""

# TODO: implement M10 VRP optimization logic
