"""
P4 OSM Enrichment — Validation Script

Run after pipeline/04_enrich_osm.py to verify the enriched output is sane.

Usage:
    . .venv/bin/activate && python tests/validate_p4.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SUMMARY_PATH = PROJECT_ROOT / "data" / "processed" / "cluster_summary.parquet"
ENRICHED_PATH = PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet"
GRAPHML_PATH = PROJECT_ROOT / "references" / "bengaluru_drive.graphml"

# Expected columns added by P4
P4_COLUMNS = [
    "road_class",
    "road_width_m",
    "osm_coverage",
    "width_source",
    "osm_edge_id",
    "road_traffic_weight",
]

# Sane ranges
MIN_CLUSTERS = 500
MAX_CLUSTERS = 5000
MIN_WIDTH_M = 2.0
MAX_WIDTH_M = 25.0
MIN_COVERAGE = 0.20
MAX_COVERAGE = 0.95


def fail(msg: str) -> None:
    print(f"  ❌ FAIL: {msg}")
    return False


def ok(msg: str) -> None:
    print(f"  ✅ {msg}")
    return True


def main() -> int:
    print("=" * 60)
    print("P4 OSM Enrichment Validation")
    print("=" * 60)

    all_good = True

    # 1. Files exist
    print("\n1. Output files exist")
    for p in [ENRICHED_PATH, GRAPHML_PATH]:
        if p.exists():
            ok(f"{p.name} exists ({p.stat().st_size / 1024 / 1024:.1f} MB)")
        else:
            all_good &= fail(f"Missing {p}")

    if not ENRICHED_PATH.exists():
        return 1

    # 2. Load data
    print("\n2. Row counts match cluster_summary")
    summary = pd.read_parquet(SUMMARY_PATH)
    enriched = pd.read_parquet(ENRICHED_PATH)

    if len(enriched) == len(summary):
        ok(f"Both files have {len(enriched):,} clusters")
    else:
        all_good &= fail(f"Row count mismatch: summary={len(summary):,}, enriched={len(enriched):,}")

    if MIN_CLUSTERS <= len(enriched) <= MAX_CLUSTERS:
        ok(f"Cluster count {len(enriched):,} is within expected range")
    else:
        all_good &= fail(f"Cluster count {len(enriched):,} outside expected range {MIN_CLUSTERS}-{MAX_CLUSTERS}")

    # 3. Required columns
    print("\n3. Required P4 columns present")
    missing = [c for c in P4_COLUMNS if c not in enriched.columns]
    if missing:
        all_good &= fail(f"Missing columns: {missing}")
    else:
        ok("All P4 columns present")

    # 4. No nulls in critical columns
    print("\n4. Critical columns have no nulls")
    critical_cols = ["cluster_id", "road_class", "road_width_m", "osm_coverage", "road_traffic_weight"]
    for col in critical_cols:
        null_count = enriched[col].isna().sum()
        if null_count == 0:
            ok(f"{col}: no nulls")
        else:
            all_good &= fail(f"{col}: {null_count:,} nulls")

    # 5. Unique cluster_ids
    print("\n5. cluster_id uniqueness")
    if enriched["cluster_id"].nunique() == len(enriched):
        ok("All cluster_ids are unique")
    else:
        all_good &= fail("Duplicate cluster_ids found")

    # 6. Road width sanity
    print("\n6. Road width sanity")
    if enriched["road_width_m"].between(MIN_WIDTH_M, MAX_WIDTH_M).all():
        ok(f"All widths between {MIN_WIDTH_M}m and {MAX_WIDTH_M}m")
    else:
        bad = enriched[~enriched["road_width_m"].between(MIN_WIDTH_M, MAX_WIDTH_M)]
        all_good &= fail(f"{len(bad):,} rows have out-of-range widths: min={bad['road_width_m'].min()}, max={bad['road_width_m'].max()}")

    print(f"   Width stats: mean={enriched['road_width_m'].mean():.2f}m, median={enriched['road_width_m'].median():.2f}m, max={enriched['road_width_m'].max():.1f}m")

    # 7. OSM coverage sanity
    print("\n7. OSM coverage sanity")
    coverage = enriched["osm_coverage"].mean()
    if MIN_COVERAGE <= coverage <= MAX_COVERAGE:
        ok(f"OSM-derived coverage = {coverage:.1%} (expected {MIN_COVERAGE:.0%}-{MAX_COVERAGE:.0%})")
    else:
        all_good &= fail(f"OSM-derived coverage = {coverage:.1%}, outside expected range")

    print("   Width source breakdown:")
    for source, count in enriched["width_source"].value_counts().items():
        print(f"      - {source}: {count:,} ({count / len(enriched):.1%})")

    # 8. Road class distribution sanity
    print("\n8. Road class distribution")
    top_classes = enriched["road_class"].value_counts().head(5)
    print("   Top 5 classes:")
    for cls, count in top_classes.items():
        print(f"      - {cls}: {count:,} ({count / len(enriched):.1%})")

    expected_classes = {"primary", "secondary", "tertiary", "residential", "trunk"}
    found_classes = set(enriched["road_class"].unique())
    if expected_classes & found_classes:
        ok(f"Found expected road classes: {sorted(expected_classes & found_classes)}")
    else:
        all_good &= fail(f"No expected road classes found. Unique: {found_classes}")

    # 9. Centroids preserved
    print("\n9. Centroids preserved from cluster_summary")
    merged = summary[["cluster_id", "centroid_lat", "centroid_lng"]].merge(
        enriched[["cluster_id", "centroid_lat", "centroid_lng"]],
        on="cluster_id",
        suffixes=("_summary", "_enriched"),
    )
    lat_diff = (merged["centroid_lat_summary"] - merged["centroid_lat_enriched"]).abs().max()
    lng_diff = (merged["centroid_lng_summary"] - merged["centroid_lng_enriched"]).abs().max()
    if lat_diff < 1e-9 and lng_diff < 1e-9:
        ok("Centroids unchanged")
    else:
        all_good &= fail(f"Centroids changed: lat_diff={lat_diff}, lng_diff={lng_diff}")

    # 10. Spot-check top clusters
    print("\n10. Spot-check top 10 clusters")
    cols = ["cluster_id", "violation_count", "road_class", "road_width_m", "width_source", "osm_coverage"]
    print(enriched[cols].head(10).to_string(index=False))

    # Final verdict
    print("\n" + "=" * 60)
    if all_good:
        print("P4 validation: ALL CHECKS PASSED")
        return 0
    else:
        print("P4 validation: SOME CHECKS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
