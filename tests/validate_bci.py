"""
M7 BCI — Validation Script

Run after pipeline/m7_bci.py to verify BCI outputs are sane.

Usage:
    . .venv/bin/activate && python tests/validate_bci.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENRICHED_PATH = PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet"

# Expected BCI columns
BCI_COLUMNS = [
    "node_betweenness_u",
    "node_betweenness_v",
    "edge_betweenness_raw",
    "alt_routes_proxy",
    "edge_betweenness_norm",
    "alt_routes_norm",
    "bci",
]


def fail(msg: str) -> bool:
    print(f"  ❌ FAIL: {msg}")
    return False


def ok(msg: str) -> bool:
    print(f"  ✅ {msg}")
    return True


def main() -> int:
    print("=" * 60)
    print("M7 BCI Validation")
    print("=" * 60)

    all_good = True

    # 1. File exists
    print("\n1. Output file exists")
    if ENRICHED_PATH.exists():
        ok(f"{ENRICHED_PATH.name} exists")
    else:
        all_good &= fail(f"Missing {ENRICHED_PATH}")
        return 1

    # 2. Required columns
    print("\n2. Required BCI columns present")
    df = pd.read_parquet(ENRICHED_PATH)
    missing = [c for c in BCI_COLUMNS if c not in df.columns]
    if missing:
        all_good &= fail(f"Missing columns: {missing}")
    else:
        ok("All BCI columns present")

    # 3. BCI range
    print("\n3. BCI range [0, 1]")
    min_bci = df["bci"].min()
    max_bci = df["bci"].max()
    if 0.0 <= min_bci and max_bci <= 1.0:
        ok(f"All BCI values between {min_bci:.4f} and {max_bci:.4f}")
    else:
        all_good &= fail(f"BCI out of range: min={min_bci:.4f}, max={max_bci:.4f}")

    # 4. Statistics
    print("\n4. BCI statistics")
    print(f"   Mean: {df['bci'].mean():.4f}")
    print(f"   Median: {df['bci'].median():.4f}")
    print(f"   Std: {df['bci'].std():.4f}")
    if df["bci"].std() > 0.001:
        ok("BCI has meaningful spread")
    else:
        all_good &= fail("BCI is degenerate (std <= 0.001)")

    # 5. Top BCI road classes
    print("\n5. Top-BCI cluster profile")
    top_bci = df.nlargest(20, "bci")
    top_classes = top_bci["road_class"].value_counts()
    print("   Road-class distribution in top 20 BCI:")
    for cls, count in top_classes.items():
        print(f"      - {cls}: {count}")

    major_classes = {"primary", "secondary", "tertiary", "trunk", "trunk_link"}
    major_count = sum(c for cls, c in top_classes.items() if cls in major_classes)
    if major_count >= 15:
        ok(f"Top-BCI clusters are mostly on major roads ({major_count}/20)")
    else:
        all_good &= fail(f"Only {major_count}/20 top-BCI clusters are on major roads")

    # 6. Divergence from violation_count ranking
    print("\n6. BCI ranking diverges from violation_count ranking")
    top_bci_ids = set(df.nlargest(10, "bci")["cluster_id"])
    top_count_ids = set(df.nlargest(10, "violation_count")["cluster_id"])
    overlap = top_bci_ids & top_count_ids
    print(f"   Top-10 BCI ∩ Top-10 count: {len(overlap)} clusters")
    print(f"   Overlap: {sorted(overlap) if overlap else 'none'}")
    if len(overlap) < 10:
        ok("BCI ranking diverges from violation_count ranking")
    else:
        all_good &= fail("BCI ranking identical to violation_count ranking")

    # 7. Low-count / high-BCI demo beat
    print("\n7. Low-count / high-BCI demo beat")
    bci_threshold = df["bci"].quantile(0.90)
    low_count_high_bci = df[
        (df["violation_count"] <= df["violation_count"].quantile(0.25))
        & (df["bci"] >= bci_threshold)
    ]
    print(f"   Top-10% BCI threshold: {bci_threshold:.4f}")
    print(f"   Bottom-25% count clusters in top-10% BCI: {len(low_count_high_bci)}")
    if len(low_count_high_bci) > 0:
        ok("Low-count / high-BCI demo beat exists")
        print("   Examples:")
        print(low_count_high_bci.head(5)[["cluster_id", "violation_count", "road_class", "bci"]].to_string(index=False))
    else:
        all_good &= fail("No low-count / high-BCI demo beat")

    # 8. Spot-check top 20 BCI
    print("\n8. Top 20 BCI clusters")
    cols = [
        "cluster_id", "violation_count", "road_class", "road_width_m",
        "lcle_pct", "edge_betweenness_norm", "alt_routes_norm", "bci",
    ]
    print(df.nlargest(20, "bci")[cols].to_string(index=False))

    # 9. Spot-check top 20 violation_count
    print("\n9. Top 20 violation_count clusters")
    print(
        df.nlargest(20, "violation_count")[
            ["cluster_id", "violation_count", "road_class", "road_width_m", "lcle_pct", "bci"]
        ].to_string(index=False)
    )

    print("\n" + "=" * 60)
    if all_good:
        print("BCI validation: ALL CHECKS PASSED")
        return 0
    else:
        print("BCI validation: SOME CHECKS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
