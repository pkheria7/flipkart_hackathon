"""
Stage M7 — BCI (Betweenness Centrality Index)

Purpose:
    Compute a real betweenness-centrality-based index (0–1) for each enriched
    cluster. BCI captures how critical a road segment is to the overall drivable
    network. Roads with high betweenness and few alternative routes get higher
    BCI, which boosts their ROI even if raw violation count is low.

Inputs:
    references/bengaluru_drive.graphml
    data/processed/enriched_clusters.parquet

Outputs:
    data/processed/enriched_clusters.parquet (updated in place)
    references/node_betweenness.json (cache)
    reports/BCI_VALIDATION_REPORT.md

Key transformations:
    - Load saved OSM drive graph.
    - Compute approximate node betweenness centrality via sampling (k=200).
    - Cache node-betweenness values for fast re-runs.
    - Derive edge betweenness from endpoint node betweenness.
    - Estimate alternative routes by counting edge midpoints within 200m buffer.
    - Combine into BCI = norm(edge_betweenness) / (1 + norm(alt_routes)).
    - Attach BCI to each cluster via its snapped osm_edge_id.

Owner:
    Piyush — Core ROI Pipeline spine (M7).
"""

from __future__ import annotations

import json
import math
import time
from pathlib import Path

import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REFERENCES_DIR = PROJECT_ROOT / "references"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORTS_DIR = PROJECT_ROOT / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

GRAPHML_PATH = REFERENCES_DIR / "bengaluru_drive.graphml"
NODE_BTW_CACHE = REFERENCES_DIR / "node_betweenness.json"
ENRICHED_PATH = PROCESSED_DIR / "enriched_clusters.parquet"
VALIDATION_REPORT_MD = REPORTS_DIR / "BCI_VALIDATION_REPORT.md"

BETWEENNESS_K = 200
BETWEENNESS_SEED = 42
ALT_ROUTE_BUFFER_M = 200.0
EARTH_CIRCUMFERENCE_M = 40_075_000.0  # at equator, rough
M_PER_DEGREE = EARTH_CIRCUMFERENCE_M / 360.0  # ~111,319 m/degree


# ---------------------------------------------------------------------------
# Betweenness computation / cache
# ---------------------------------------------------------------------------
def load_or_compute_node_betweenness(G: ox.graph_type) -> dict[int, float]:
    """Load cached node betweenness or compute and cache it."""
    if NODE_BTW_CACHE.exists():
        print(f"[M7] Loading cached node betweenness: {NODE_BTW_CACHE}")
        with open(NODE_BTW_CACHE, "r", encoding="utf-8") as f:
            cached = json.load(f)
        # JSON keys are strings; convert back to node IDs (int or str depending on graph)
        return {k if isinstance(k, int) else int(k): float(v) for k, v in cached.items()}

    print(f"[M7] Computing approximate node betweenness (k={BETWEENNESS_K}, seed={BETWEENNESS_SEED})...")
    start = time.time()
    G_dir = nx.DiGraph(G)
    print(f"[M7] Converted to DiGraph: {G_dir.number_of_nodes():,} nodes, {G_dir.number_of_edges():,} edges")

    node_btw = nx.betweenness_centrality(
        G_dir,
        k=BETWEENNESS_K,
        seed=BETWEENNESS_SEED,
    )
    print(f"[M7] Betweenness computed in {time.time() - start:.1f}s")

    # Cache for re-runs
    with open(NODE_BTW_CACHE, "w", encoding="utf-8") as f:
        json.dump({str(k): float(v) for k, v in node_btw.items()}, f)
    print(f"[M7] Cached node betweenness: {NODE_BTW_CACHE}")

    return node_btw


# ---------------------------------------------------------------------------
# Edge geometry / alternative routes
# ---------------------------------------------------------------------------
def compute_edge_midpoint(G: ox.graph_type, u, v, key) -> Point:
    """Return the midpoint of an edge as a shapely Point (lon, lat)."""
    data = G[u][v][key]
    geom = data.get("geometry")
    if geom is None:
        x_u, y_u = G.nodes[u]["x"], G.nodes[u]["y"]
        x_v, y_v = G.nodes[v]["x"], G.nodes[v]["y"]
        geom = LineString([(x_u, y_u), (x_v, y_v)])
    return geom.interpolate(0.5, normalized=True)


def build_edge_midpoint_index(G: ox.graph_type) -> tuple[list, STRtree, dict]:
    """Build an STRtree of all edge midpoints and return lookup structures."""
    print("[M7] Building edge midpoint spatial index...")
    start = time.time()

    edge_keys = []
    midpoints = []
    midpoint_by_edge = {}

    for u, v, key, data in G.edges(data=True, keys=True):
        mp = compute_edge_midpoint(G, u, v, key)
        edge_keys.append((u, v, key))
        midpoints.append(mp)
        midpoint_by_edge[(u, v, key)] = mp

    tree = STRtree(midpoints)
    print(f"[M7] Indexed {len(midpoints):,} edge midpoints in {time.time() - start:.1f}s")
    return edge_keys, tree, midpoint_by_edge


def count_alt_routes_within_buffer(
    edge_key: tuple,
    midpoint_by_edge: dict,
    tree: STRtree,
    all_midpoints: list,
    buffer_m: float = ALT_ROUTE_BUFFER_M,
) -> int:
    """
    Count how many other edge midpoints fall within `buffer_m` meters of the
    given edge's midpoint. This proxies the number of alternative routes nearby.
    """
    mp = midpoint_by_edge[edge_key]
    buffer_deg = buffer_m / M_PER_DEGREE
    search_geom = mp.buffer(buffer_deg)

    hits = tree.query(search_geom)
    count = 0
    for idx in hits:
        other_key = all_midpoints[idx]  # actually all_midpoints is list of keys
        if other_key == edge_key:
            continue
        other_mp = midpoint_by_edge[other_key]
        # Approximate distance in meters using degree-to-meter conversion
        dist_m = mp.distance(other_mp) * M_PER_DEGREE
        if dist_m <= buffer_m:
            count += 1

    return count


# ---------------------------------------------------------------------------
# BCI computation
# ---------------------------------------------------------------------------
def normalize_min_max(values: np.ndarray) -> np.ndarray:
    """Min-max normalize to [0, 1]. If all equal, return zeros."""
    vmin, vmax = values.min(), values.max()
    if vmax == vmin:
        return np.zeros_like(values, dtype=float)
    return (values - vmin) / (vmax - vmin)


def compute_edge_bci_attributes(
    G: ox.graph_type,
    snapped_edges: list[tuple],
    node_betweenness: dict,
) -> pd.DataFrame:
    """Compute edge_betweenness, alt_routes, and bci for the snapped edges."""
    edge_keys, tree, midpoint_by_edge = build_edge_midpoint_index(G)

    records = []
    edge_betweenness_raw = []
    alt_routes_raw = []

    for edge_key in snapped_edges:
        u, v, key = edge_key
        edge_btw = (node_betweenness.get(u, 0.0) + node_betweenness.get(v, 0.0)) / 2.0
        edge_betweenness_raw.append(edge_btw)

        alt_routes = count_alt_routes_within_buffer(
            edge_key, midpoint_by_edge, tree, edge_keys
        )
        alt_routes_raw.append(alt_routes)

        records.append({
            "osm_edge_id": f"{u}-{v}-{key}",
            "node_betweenness_u": node_betweenness.get(u, 0.0),
            "node_betweenness_v": node_betweenness.get(v, 0.0),
            "edge_betweenness_raw": edge_btw,
            "alt_routes_proxy": alt_routes,
        })

    edge_btw_arr = np.array(edge_betweenness_raw, dtype=float)
    alt_routes_arr = np.array(alt_routes_raw, dtype=float)

    edge_btw_norm = normalize_min_max(edge_btw_arr)
    alt_routes_norm = normalize_min_max(alt_routes_arr)

    # BCI = high betweenness, few alternatives
    bci = edge_btw_norm / (1.0 + alt_routes_norm)
    bci = normalize_min_max(bci)  # final normalization to [0, 1]

    for i, record in enumerate(records):
        record["edge_betweenness_norm"] = float(edge_btw_norm[i])
        record["alt_routes_norm"] = float(alt_routes_norm[i])
        record["bci"] = float(bci[i])

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------
def write_validation_report(df: pd.DataFrame) -> None:
    mean_bci = df["bci"].mean()
    median_bci = df["bci"].median()
    std_bci = df["bci"].std()
    min_bci = df["bci"].min()
    max_bci = df["bci"].max()

    top_bci = df.nlargest(20, "bci")[[
        "cluster_id", "violation_count", "road_class", "road_width_m",
        "lcle_pct", "edge_betweenness_norm", "alt_routes_norm", "bci",
    ]]

    top_count = df.nlargest(20, "violation_count")[[
        "cluster_id", "violation_count", "road_class", "road_width_m", "lcle_pct", "bci",
    ]]

    # Check low-count / high-BCI demo beat
    # "High BCI" is defined as top 10% BCI rather than an absolute threshold,
    # because betweenness centrality is naturally heavily skewed.
    bci_threshold = df["bci"].quantile(0.90)
    low_count_high_bci = df[
        (df["violation_count"] <= df["violation_count"].quantile(0.25))
        & (df["bci"] >= bci_threshold)
    ]

    # Road class distribution in top BCI
    top_bci_road_classes = top_bci["road_class"].value_counts().to_dict()

    lines = [
        "# BCI Validation Report",
        "",
        "## Methodology",
        "BCI (Betweenness Centrality Index) estimates how critical a road segment is to the drivable network.",
        "",
        "### Formula",
        "```",
        "node_betweenness   = approximate betweenness centrality of each OSM node (k=200 sampling)",
        "edge_betweenness   = (node_betweenness[u] + node_betweenness[v]) / 2",
        "alt_routes_proxy   = count of other edge midpoints within 200m",
        "edge_betweenness_norm = min-max normalize(edge_betweenness)",
        "alt_routes_norm  = min-max normalize(alt_routes_proxy)",
        "bci = normalize(edge_betweenness_norm / (1 + alt_routes_norm))",
        "```",
        "",
        "## BCI distribution",
        f"- Mean BCI: {mean_bci:.4f}",
        f"- Median BCI: {median_bci:.4f}",
        f"- Std BCI: {std_bci:.4f}",
        f"- Min BCI: {min_bci:.4f}",
        f"- Max BCI: {max_bci:.4f}",
        "",
        "## Top 20 clusters by BCI",
        "",
        "| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | edge_betweenness_norm | alt_routes_norm | bci |",
        "|------|------------|-----------------|------------|--------------|----------|----------------------|-----------------|-----|",
    ]
    for rank, (_, row) in enumerate(top_bci.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {int(row['violation_count']):,} | "
            f"{row['road_class']} | {row['road_width_m']:.1f} | {row['lcle_pct']:.2f} | "
            f"{row['edge_betweenness_norm']:.4f} | {row['alt_routes_norm']:.4f} | {row['bci']:.4f} |"
        )
    lines.append("")

    lines.extend([
        "### Road-class distribution in top 20 BCI",
    ])
    for cls, count in top_bci_road_classes.items():
        lines.append(f"- {cls}: {count}")
    lines.append("")

    lines.extend([
        "## Top 20 clusters by violation_count (for divergence check)",
        "",
        "| rank | cluster_id | violation_count | road_class | road_width_m | lcle_pct | bci |",
        "|------|------------|-----------------|------------|--------------|----------|-----|",
    ])
    for rank, (_, row) in enumerate(top_count.iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {int(row['violation_count']):,} | "
            f"{row['road_class']} | {row['road_width_m']:.1f} | {row['lcle_pct']:.2f} | {row['bci']:.4f} |"
        )
    lines.append("")

    lines.extend([
        "## Low-count / high-BCI demo beat",
        f"- Top-10% BCI threshold: {bci_threshold:.4f}",
        f"- Clusters in bottom 25% violation_count AND top 10% BCI: **{len(low_count_high_bci)}**",
    ])
    if len(low_count_high_bci) > 0:
        lines.append("")
        lines.append("| cluster_id | violation_count | road_class | bci |")
        lines.append("|------------|-----------------|------------|-----|")
        for _, row in low_count_high_bci.head(10).iterrows():
            lines.append(
                f"| {row['cluster_id']} | {int(row['violation_count']):,} | {row['road_class']} | {row['bci']:.4f} |"
            )
    lines.append("")

    # Checks
    range_ok = 0.0 <= min_bci and max_bci <= 1.0
    spread_ok = std_bci > 0.001
    top_bci_ids = set(top_bci["cluster_id"].head(10))
    top_count_ids = set(top_count["cluster_id"].head(10))
    divergence_ok = not top_bci_ids.issubset(top_count_ids)
    demo_beat_ok = len(low_count_high_bci) > 0

    lines.extend([
        "## Checks",
        f"- BCI range [0, 1]: {'PASS' if range_ok else 'FAIL'}",
        f"- BCI spread > 0.001: {'PASS' if spread_ok else 'FAIL'} (std={std_bci:.4f})",
        f"- BCI diverges from violation_count: {'PASS' if divergence_ok else 'FAIL'}",
        f"- Low-count / high-BCI demo beat exists: {'PASS' if demo_beat_ok else 'FAIL'}",
        "",
        "## Limitations",
        "- Node betweenness is sampled (k=200) to keep computation tractable on a 155k-node graph.",
        "- Alternative routes are approximated by nearby edge count, not actual route redundancy.",
        "- Edge betweenness is approximated by averaging endpoint node betweenness.",
        "",
        f"## Final verdict: {'PASS' if (range_ok and spread_ok and divergence_ok and demo_beat_ok) else 'FAIL'}",
    ])

    VALIDATION_REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[M7] Saved validation report: {VALIDATION_REPORT_MD}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def compute_bci() -> dict:
    print(f"[M7] Loading enriched clusters: {ENRICHED_PATH}")
    df = pd.read_parquet(ENRICHED_PATH)
    print(f"[M7] Clusters loaded: {len(df):,}")

    if "osm_edge_id" not in df.columns:
        raise ValueError("Missing 'osm_edge_id' column. Re-run P4 OSM enrichment first.")

    print(f"[M7] Loading road graph: {GRAPHML_PATH}")
    G = ox.load_graphml(GRAPHML_PATH)
    print(f"[M7] Graph: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")

    node_betweenness = load_or_compute_node_betweenness(G)

    print("[M7] Computing BCI for snapped edges...")
    # Deduplicate edges: many clusters can snap to the same OSM edge.
    # Compute attributes once per unique edge to avoid a Cartesian merge.
    unique_edge_ids = df["osm_edge_id"].unique()
    unique_snapped_edges = []
    edge_id_to_tuple = {}
    for edge_id in unique_edge_ids:
        edge_tuple = edge_id_to_tuple.get(edge_id)
        if edge_tuple is None:
            parts = str(edge_id).split("-")
            if len(parts) != 3:
                raise ValueError(f"Invalid osm_edge_id format: {edge_id}")
            u, v, key = parts
            try:
                u = int(u)
                v = int(v)
            except ValueError:
                pass
            key = int(key)
            edge_tuple = (u, v, key)
            edge_id_to_tuple[edge_id] = edge_tuple
        unique_snapped_edges.append(edge_tuple)

    edge_attrs_df = compute_edge_bci_attributes(G, unique_snapped_edges, node_betweenness)

    # Drop any stale BCI columns so the merge is idempotent
    stale_cols = [
        "node_betweenness_u", "node_betweenness_v", "edge_betweenness_raw",
        "alt_routes_proxy", "edge_betweenness_norm", "alt_routes_norm", "bci",
    ]
    df = df.drop(columns=[c for c in stale_cols if c in df.columns])

    # Merge back
    df = df.merge(edge_attrs_df, on="osm_edge_id", how="left")

    # Fill any missing BCI with 0 (should not happen unless merge fails)
    df["bci"] = df["bci"].fillna(0.0)

    df.to_parquet(ENRICHED_PATH, index=False)
    print(f"[M7] Saved updated enriched clusters: {ENRICHED_PATH}")

    write_validation_report(df)

    return {
        "enriched_clusters_path": str(ENRICHED_PATH),
        "n_clusters": len(df),
        "mean_bci": float(df["bci"].mean()),
        "median_bci": float(df["bci"].median()),
    }


if __name__ == "__main__":
    result = compute_bci()
    print("\n[M7] BCI computation summary:")
    print(json.dumps(result, indent=2, default=str))
