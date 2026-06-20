"""
M2 LCLE — Validation Script

Run after pipeline/05_score.py to verify LCLE outputs are sane.

Usage:
    . .venv/bin/activate && python tests/validate_lcle.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENRICHED_PATH = PROJECT_ROOT / "data" / "processed" / "enriched_clusters.parquet"

# Expected LCLE columns
LCLE_COLUMNS = [
    "weighted_avg_vehicle_width",
    "occupancy_proxy",
    "raw_block",
    "lcle_pct",
    "lcle_confidence",
    "road_width_source",
]


def fail(msg: str) -> bool:
    print(f"  ❌ FAIL: {msg}")
    return False


def ok(msg: str) -> bool:
    print(f"  ✅ {msg}")
    return True


def main() -> int:
    print("=" * 60)
    print("M2 LCLE Validation")
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
    print("\n2. Required LCLE columns present")
    df = pd.read_parquet(ENRICHED_PATH)
    missing = [c for c in LCLE_COLUMNS if c not in df.columns]
    if missing:
        all_good &= fail(f"Missing columns: {missing}")
    else:
        ok("All LCLE columns present")

    # 3. LCLE range
    print("\n3. LCLE range 0–100")
    min_lcle = df["lcle_pct"].min()
    max_lcle = df["lcle_pct"].max()
    if 0.0 <= min_lcle and max_lcle <= 100.0:
        ok(f"All LCLE values between {min_lcle:.2f}% and {max_lcle:.2f}%")
    else:
        all_good &= fail(f"LCLE out of range: min={min_lcle:.2f}, max={max_lcle:.2f}")

    # 4. Statistics
    print("\n4. LCLE statistics")
    print(f"   Mean: {df['lcle_pct'].mean():.2f}%")
    print(f"   Median: {df['lcle_pct'].median():.2f}%")
    print(f"   Std: {df['lcle_pct'].std():.2f}%")
    if df["lcle_pct"].mean() < 90.0:
        ok("Mean LCLE is below 90% (not saturated)")
    else:
        all_good &= fail("Mean LCLE is >= 90%, likely saturated")

    # 5. Confidence distribution
    print("\n5. Confidence distribution")
    print(df["lcle_confidence"].value_counts().to_string())
    expected_confidences = {"HIGH", "MEDIUM", "LOW"}
    if expected_confidences.issubset(set(df["lcle_confidence"].unique())):
        ok("All confidence levels present")
    else:
        all_good &= fail(f"Missing confidence levels: {expected_confidences - set(df['lcle_confidence'].unique())}")

    # 6. Road width source
    print("\n6. Road width source distribution")
    print(df["road_width_source"].value_counts().to_string())
    if set(df["road_width_source"].unique()).issubset({"osm_width", "irc_default"}):
        ok("road_width_source values are valid")
    else:
        all_good &= fail("Invalid road_width_source values")

    # 7. High LCLE clusters are narrow / large vehicles / junction-heavy
    print("\n7. High-LCLE cluster profile")
    top_lcle = df.nlargest(20, "lcle_pct")
    avg_width_top = top_lcle["road_width_m"].mean()
    avg_vehicle_width_top = top_lcle["weighted_avg_vehicle_width"].mean()
    avg_junction_top = top_lcle["junction_flag_rate"].mean()
    avg_lcle_top = top_lcle["lcle_pct"].mean()

    print(f"   Top 20 LCLE avg road_width: {avg_width_top:.2f}m")
    print(f"   Top 20 LCLE avg vehicle width: {avg_vehicle_width_top:.2f}m")
    print(f"   Top 20 LCLE avg junction_flag_rate: {avg_junction_top:.3f}")
    print(f"   Top 20 LCLE avg lcle_pct: {avg_lcle_top:.2f}%")

    if avg_width_top <= df["road_width_m"].mean():
        ok("Top-LCLE clusters tend to have narrower roads")
    else:
        all_good &= fail("Top-LCLE clusters have wider roads than average")

    if avg_vehicle_width_top >= df["weighted_avg_vehicle_width"].mean():
        ok("Top-LCLE clusters tend to have larger vehicle footprints")
    else:
        all_good &= fail("Top-LCLE clusters have smaller vehicle footprints than average")

    # 8. Divergence from violation_count ranking
    print("\n8. LCLE ranking diverges from violation_count ranking")
    top_lcle_ids = set(df.nlargest(10, "lcle_pct")["cluster_id"])
    top_count_ids = set(df.nlargest(10, "violation_count")["cluster_id"])
    overlap = top_lcle_ids & top_count_ids
    print(f"   Top-10 LCLE ∩ Top-10 count: {len(overlap)} clusters")
    print(f"   Overlap: {sorted(overlap) if overlap else 'none'}")
    if len(overlap) < 10:
        ok("LCLE ranking diverges from violation_count ranking")
    else:
        all_good &= fail("LCLE ranking identical to violation_count ranking")

    # 9. Spot-check top 20 LCLE
    print("\n9. Top 20 LCLE clusters")
    cols = [
        "cluster_id", "violation_count", "road_class", "road_width_m",
        "road_width_source", "weighted_avg_vehicle_width", "occupancy_proxy",
        "raw_block", "junction_flag_rate", "lcle_pct", "lcle_confidence",
    ]
    print(df[cols].head(20).to_string(index=False))

    # 10. Spot-check top 20 violation_count
    print("\n10. Top 20 violation_count clusters")
    print(
        df.nlargest(20, "violation_count")[
            ["cluster_id", "violation_count", "road_class", "road_width_m", "lcle_pct"]
        ].to_string(index=False)
    )

    print("\n" + "=" * 60)
    if all_good:
        print("LCLE validation: ALL CHECKS PASSED")
        return 0
    else:
        print("LCLE validation: SOME CHECKS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
