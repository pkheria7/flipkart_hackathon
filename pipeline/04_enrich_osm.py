"""
Stage P4 — OSM Enrichment

Purpose:
    Download Bengaluru's drivable road network from OpenStreetMap once, save it
    to disk, snap each cluster centroid to the nearest road edge, and attach
    road class and width attributes. Missing widths are filled first from OSM
    lane counts, then from IRC defaults.

Inputs:
    data/processed/cluster_summary.parquet

Outputs:
    data/processed/enriched_clusters.parquet
    references/bengaluru_drive.graphml

Key transformations:
    - Download drive network with osmnx.graph_from_place.
    - Persist graph to references/bengaluru_drive.graphml.
    - Snap centroids with ox.distance.nearest_edges.
    - Read highway class, width, and lanes tags.
    - Estimate width from lanes when width is missing.
    - Fall back to IRC defaults only when no OSM width/lanes data exists.
    - Record osm_coverage flag (1 = OSM-derived width/lanes, 0 = IRC default).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import osmnx as ox
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REFERENCES_DIR = PROJECT_ROOT / "references"
REFERENCES_DIR.mkdir(parents=True, exist_ok=True)

INPUT_SUMMARY_PARQUET = PROCESSED_DIR / "cluster_summary.parquet"
OUTPUT_ENRICHED_PARQUET = PROCESSED_DIR / "enriched_clusters.parquet"
GRAPHML_PATH = REFERENCES_DIR / "bengaluru_drive.graphml"

# OSM place query
PLACE_QUERY = "Bengaluru, India"
NETWORK_TYPE = "drive"

# IRC default widths in meters (Indian Roads Congress approximations)
IRC_DEFAULT_WIDTH_M = {
    "motorway": 7.0,
    "trunk": 7.0,
    "primary": 7.0,
    "primary_link": 7.0,
    "secondary": 5.5,
    "secondary_link": 5.5,
    "tertiary": 4.0,
    "tertiary_link": 4.0,
    "residential": 3.5,
    "living_street": 3.5,
    "service": 3.0,
    "unclassified": 3.5,
    "road": 3.5,
}
DEFAULT_WIDTH = 3.5  # fallback for any unknown highway class

# Lane width per highway class for estimating road width from lane count
LANE_WIDTH_M = {
    "motorway": 3.5,
    "trunk": 3.5,
    "primary": 3.5,
    "primary_link": 3.5,
    "secondary": 3.25,
    "secondary_link": 3.25,
    "tertiary": 3.0,
    "tertiary_link": 3.0,
    "residential": 3.0,
    "living_street": 3.0,
    "service": 2.75,
    "unclassified": 3.0,
    "road": 3.0,
}
DEFAULT_LANE_WIDTH = 3.0

# Traffic weight for downstream ROI scoring (mirrors the contract)
TRAFFIC_WEIGHT = {
    "motorway": 1.0,
    "motorway_link": 1.0,
    "trunk": 1.0,
    "trunk_link": 0.8,
    "primary": 1.0,
    "primary_link": 0.9,
    "secondary": 0.7,
    "secondary_link": 0.65,
    "tertiary": 0.5,
    "tertiary_link": 0.45,
    "residential": 0.3,
    "living_street": 0.3,
    "service": 0.15,
    "unclassified": 0.2,
    "road": 0.2,
}
DEFAULT_TRAFFIC_WEIGHT = 0.15


# ---------------------------------------------------------------------------
# Graph download / load
# ---------------------------------------------------------------------------
def load_or_download_graph() -> ox.graph_type:
    """Load the saved Bengaluru drive graph, or download and save it once."""
    if GRAPHML_PATH.exists():
        print(f"[P4] Loading saved graph: {GRAPHML_PATH}")
        G = ox.load_graphml(GRAPHML_PATH)
        print(f"[P4] Graph loaded: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")
        return G

    print(f"[P4] Downloading drive network for '{PLACE_QUERY}'...")
    G = ox.graph_from_place(PLACE_QUERY, network_type=NETWORK_TYPE, simplify=True)
    print(f"[P4] Downloaded graph: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")

    ox.save_graphml(G, GRAPHML_PATH)
    print(f"[P4] Saved graph to: {GRAPHML_PATH}")
    return G


# ---------------------------------------------------------------------------
# Road attribute extraction
# ---------------------------------------------------------------------------
def pick_highway_class(highway_value) -> str:
    """Return a single highway class string from OSM edge data."""
    if isinstance(highway_value, list):
        # Some edges have multiple tags; take the first useful one
        for val in highway_value:
            if val in IRC_DEFAULT_WIDTH_M:
                return val
        return str(highway_value[0]) if highway_value else "unclassified"
    if isinstance(highway_value, str):
        return highway_value
    return "unclassified"


def parse_width(width_value) -> float | None:
    """Parse an OSM width tag into meters, or None if unusable."""
    if width_value is None:
        return None

    # Handle list-ish values (rare)
    if isinstance(width_value, (list, tuple)):
        width_value = width_value[0] if width_value else None
    if width_value is None:
        return None

    text = str(width_value).strip()
    if text in {"", "NULL", "null", "None", "nan"}:
        return None

    # Common patterns: "3.5", "3.5 m", "3.5m", "~4", "4;5"
    # Take the first numeric token
    match = re.search(r"[\d\.\/]+", text)
    if not match:
        return None

    token = match.group(0)
    try:
        if "/" in token:
            num, den = token.split("/", 1)
            value = float(num) / float(den)
        else:
            value = float(token)
    except ValueError:
        return None

    # Sanity bounds: OSM widths should be in meters. If > 100, assume cm or typo.
    if value <= 0:
        return None
    if value > 100:
        value = value / 100.0
    return value


def parse_lanes(lanes_value) -> int | None:
    """Parse an OSM lanes tag into an integer lane count, or None if unusable."""
    if lanes_value is None:
        return None

    if isinstance(lanes_value, (list, tuple)):
        lanes_value = lanes_value[0] if lanes_value else None
    if lanes_value is None:
        return None

    text = str(lanes_value).strip()
    if text in {"", "NULL", "null", "None", "nan"}:
        return None

    # Some lanes tags are ranges or lists (e.g. "2;1"). Take the first number.
    match = re.search(r"\d+", text)
    if not match:
        return None

    try:
        value = int(match.group(0))
    except ValueError:
        return None

    if value <= 0 or value > 20:
        return None
    return value


def estimate_width_from_lanes(highway: str, lanes: int | None) -> float | None:
    """Estimate road width from lane count and highway class."""
    if lanes is None:
        return None
    lane_width = LANE_WIDTH_M.get(highway, DEFAULT_LANE_WIDTH)
    return lanes * lane_width


def resolve_width_and_coverage(edge_data: dict, highway: str) -> tuple[float, int, str]:
    """
    Return (width_m, osm_coverage, source) for an edge.

    Coverage:
      1 = width derived from an OSM tag (width, est_width, or lanes)
      0 = pure IRC default based on highway class only
    """
    # 1. Direct width tag
    width_m = parse_width(edge_data.get("width"))
    if width_m is not None:
        return width_m, 1, "width_tag"

    # 2. Estimated width tag
    width_m = parse_width(edge_data.get("est_width"))
    if width_m is not None:
        return width_m, 1, "est_width_tag"

    # 3. Estimate from lanes
    lanes = parse_lanes(edge_data.get("lanes"))
    width_m = estimate_width_from_lanes(highway, lanes)
    if width_m is not None:
        return width_m, 1, "lanes_estimate"

    # 4. IRC default
    width_m = IRC_DEFAULT_WIDTH_M.get(highway, DEFAULT_WIDTH)
    return width_m, 0, "irc_default"


def enrich_clusters(summary_df: pd.DataFrame, G: ox.graph_type) -> pd.DataFrame:
    """Snap cluster centroids to the road graph and attach road attributes."""
    df = summary_df.copy()

    lons = df["centroid_lng"].astype(float).values
    lats = df["centroid_lat"].astype(float).values

    print(f"[P4] Snapping {len(df):,} cluster centroids to nearest edges...")
    nearest = ox.distance.nearest_edges(G, lons, lats)

    # Ensure iterable shape (nearest_edges may return a single tuple for one point)
    if isinstance(nearest, tuple):
        nearest = [nearest]

    # nearest is an array of (u, v, key) tuples
    edges = []
    for (u, v, key) in nearest:
        try:
            edge_data = G[u][v][key]
        except KeyError:
            edge_data = {}
        edges.append((u, v, key, edge_data))

    road_classes = []
    road_widths = []
    osm_coverage = []
    width_sources = []
    edge_ids = []
    traffic_weights = []

    for u, v, key, edge_data in edges:
        highway = pick_highway_class(edge_data.get("highway", "unclassified"))
        width_m, covered, source = resolve_width_and_coverage(edge_data, highway)

        road_classes.append(highway)
        road_widths.append(width_m)
        osm_coverage.append(covered)
        width_sources.append(source)
        edge_ids.append(f"{u}-{v}-{key}")
        traffic_weights.append(TRAFFIC_WEIGHT.get(highway, DEFAULT_TRAFFIC_WEIGHT))

    df["road_class"] = road_classes
    df["road_width_m"] = road_widths
    df["osm_coverage"] = osm_coverage
    df["width_source"] = width_sources
    df["osm_edge_id"] = edge_ids
    df["road_traffic_weight"] = traffic_weights

    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def enrich_osm() -> dict:
    print(f"[P4] Loading cluster summary: {INPUT_SUMMARY_PARQUET}")
    summary_df = pd.read_parquet(INPUT_SUMMARY_PARQUET)
    print(f"[P4] Clusters to enrich: {len(summary_df):,}")

    G = load_or_download_graph()
    enriched_df = enrich_clusters(summary_df, G)

    coverage_rate = enriched_df["osm_coverage"].mean()
    source_counts = enriched_df["width_source"].value_counts().to_dict()
    print(f"[P4] OSM-derived width coverage: {coverage_rate:.1%}")
    for source, count in source_counts.items():
        print(f"[P4]   - {source}: {count:,} ({count / len(enriched_df):.1%})")

    enriched_df.to_parquet(OUTPUT_ENRICHED_PARQUET, index=False)
    print(f"[P4] Saved enriched clusters: {OUTPUT_ENRICHED_PARQUET}")

    return {
        "enriched_clusters_path": str(OUTPUT_ENRICHED_PARQUET),
        "graphml_path": str(GRAPHML_PATH),
        "n_clusters": len(enriched_df),
        "osm_coverage_rate": float(coverage_rate),
        "width_source_counts": source_counts,
    }


if __name__ == "__main__":
    result = enrich_osm()
    print("\n[P4] OSM enrichment summary:")
    print(json.dumps(result, indent=2, default=str))
