"""
04b — Road Graph Builder

Downloads the Bengaluru drive graph from OSM via the Overpass API and saves
it to cache/bengaluru_drive_graph.graphml with edge speeds and travel times.

The graph is used by pipeline/06_optimize_vrp.py in graph routing mode.
If the graph cannot be built (no internet / Overpass timeout), M10 falls back
to haversine routing automatically.

Usage:
    python pipeline/04b_build_road_graph.py
    python pipeline/04b_build_road_graph.py --buffer 0.05
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT        = Path(__file__).resolve().parent.parent
_SCORED_PARQ = ROOT / "data" / "outputs" / "scored_hotspots.parquet"
_SCORED_CSV  = ROOT / "data" / "outputs" / "scored_hotspots.csv"
_GRAPH_PATH  = ROOT / "cache" / "bengaluru_drive_graph.graphml"

DEFAULT_BUFFER = 0.03  # degrees lat/lon


def _load_hotspots():
    try:
        import pandas as pd
    except ImportError:
        print("ERROR: pandas not installed.")
        sys.exit(1)

    if _SCORED_PARQ.exists():
        return pd.read_parquet(_SCORED_PARQ)
    if _SCORED_CSV.exists():
        return pd.read_csv(_SCORED_CSV)
    print(f"ERROR: Scored hotspots not found at:\n  {_SCORED_PARQ}\n  {_SCORED_CSV}")
    print("Run the scoring pipeline first.")
    sys.exit(1)


def build_graph(buffer: float = DEFAULT_BUFFER) -> None:
    # Lazy import — fail clearly if not installed
    try:
        import osmnx as ox
    except ImportError:
        print("ERROR: OSMnx is not installed.")
        print("  Install with: pip install osmnx")
        sys.exit(1)

    df = _load_hotspots()

    lat_min = float(df["centroid_lat"].min()) - buffer
    lat_max = float(df["centroid_lat"].max()) + buffer
    lon_min = float(df["centroid_lng"].min()) - buffer
    lon_max = float(df["centroid_lng"].max()) + buffer

    # OSMnx 2.x bbox format: (left, bottom, right, top) = (lon_min, lat_min, lon_max, lat_max)
    bbox = (lon_min, lat_min, lon_max, lat_max)

    print(f"Bounding box (with {buffer}° buffer):")
    print(f"  lat: [{lat_min:.4f}, {lat_max:.4f}]")
    print(f"  lon: [{lon_min:.4f}, {lon_max:.4f}]")
    print()
    print("Downloading drive graph from Overpass API...")
    print("(This may take 30–120 s depending on network and server load)")

    try:
        G = ox.graph_from_bbox(bbox=bbox, network_type="drive")
    except Exception as exc:
        print(f"\nERROR: Graph download failed: {exc}")
        print("Common causes:")
        print("  - No internet connection")
        print("  - Overpass API rate limit / timeout (try again in a few minutes)")
        print("  - Server returned empty result for bbox")
        print("\nM10 will continue to use haversine fallback until the graph is built.")
        sys.exit(1)

    print(f"  Downloaded: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")

    # Add road speeds and travel times
    print("Adding edge speeds and travel times...")
    try:
        G = ox.add_edge_speeds(G)
        G = ox.add_edge_travel_times(G)
        # Verify at least one edge has travel_time
        sample = [d for _, _, d in list(G.edges(data=True))[:20]]
        has_travel_time = any("travel_time" in d for d in sample)
        print(f"  travel_time attribute: {'present on all edges' if has_travel_time else 'MISSING — check OSMnx version'}")
    except Exception as exc:
        has_travel_time = False
        print(f"  [warn] Could not add travel times: {exc}")
        print("  Routing will fall back to length-based estimation.")

    # Save
    _GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Saving graph to {_GRAPH_PATH}...")
    try:
        ox.save_graphml(G, filepath=_GRAPH_PATH)
    except Exception as exc:
        print(f"ERROR: Could not save graph: {exc}")
        sys.exit(1)

    size_mb = _GRAPH_PATH.stat().st_size / 1024 / 1024
    print()
    print("Graph build complete:")
    print(f"  Path:          {_GRAPH_PATH}")
    print(f"  File size:     {size_mb:.1f} MB")
    print(f"  Nodes:         {G.number_of_nodes():,}")
    print(f"  Edges:         {G.number_of_edges():,}")
    print(f"  travel_time:   {'yes' if has_travel_time else 'no — length fallback will be used'}")
    print()
    print("Run M10 with graph routing:")
    print("  python pipeline/06_optimize_vrp.py --routing-mode auto")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build Bengaluru drive graph from OSM and save to cache/",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--buffer",
        type=float,
        default=DEFAULT_BUFFER,
        help=f"Lat/lon buffer in degrees to add around hotspot bbox (default: {DEFAULT_BUFFER})",
    )
    args = parser.parse_args()
    build_graph(buffer=args.buffer)


if __name__ == "__main__":
    main()
