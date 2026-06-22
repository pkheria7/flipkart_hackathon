#!/usr/bin/env python3
"""
Verify peak violation windows are derived from IST timestamps (not raw UTC hours).

Usage:
    python scripts/verify_peak_windows.py
    python scripts/verify_peak_windows.py C_0_0 C_298 C_22
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
HANDOFF = ROOT / "data" / "processed" / "cluster_handoff_for_prakhar.parquet"
PEAK_WINDOWS = ROOT / "data" / "processed" / "cluster_peak_windows.parquet"
SCORED = ROOT / "data" / "outputs" / "scored_hotspots.parquet"

DEFAULT_CLUSTERS = ["C_0_0", "C_298", "C_22"]


def verify_cluster(cluster_id: str, handoff: pd.DataFrame, peaks: pd.DataFrame) -> None:
    print(f"\n{'=' * 72}")
    print(f"Cluster: {cluster_id}")
    print(f"{'=' * 72}")

    peak_row = peaks[peaks["cluster_id"] == cluster_id]
    if peak_row.empty:
        print("  [WARN] Not found in cluster_peak_windows.parquet")
        return

    peak_row = peak_row.iloc[0]
    m3_hour = int(peak_row["peak_hour"])
    m3_window = str(peak_row["recommended_patrol_window"])
    print(f"  M3 peak_hour (IST):           {m3_hour}")
    print(f"  M3 recommended_patrol_window: {m3_window}")

    cluster_rows = handoff[handoff["cluster_id"] == cluster_id]
    if cluster_rows.empty:
        print("  [WARN] No handoff rows for cluster")
        return

    # Hour column is hour_ist alias from P1 (Asia/Kolkata)
    hour_counts = cluster_rows["hour"].value_counts().sort_index()
    derived_peak_hour = int(hour_counts.idxmax())
    derived_window = f"{derived_peak_hour:02d}:00-{(derived_peak_hour + 2) % 24:02d}:00"

    print(f"  Handoff-derived peak hour:    {derived_peak_hour}")
    print(f"  Handoff-derived 2h window:    {derived_window}")
    print(f"  Match M3 peak_hour:           {derived_peak_hour == m3_hour}")

    sample = cluster_rows.sample(min(3, len(cluster_rows)), random_state=42)
    print("\n  Sample violation timestamps (IST):")
    for _, row in sample.iterrows():
        ist = row["created_datetime_ist"]
        hour_ist = int(row["hour"])
        print(f"    created_datetime_ist={ist}  hour_ist={hour_ist}")

    if SCORED.exists():
        scored = pd.read_parquet(SCORED, columns=["cluster_id", "peak_window"])
        api_row = scored[scored["cluster_id"] == cluster_id]
        if not api_row.empty:
            print(f"\n  API peak_window (scored_hotspots): {api_row.iloc[0]['peak_window']}")


def main() -> None:
    clusters = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_CLUSTERS

    if not HANDOFF.exists():
        raise SystemExit(f"Missing handoff file: {HANDOFF}")
    if not PEAK_WINDOWS.exists():
        raise SystemExit(f"Missing peak windows file: {PEAK_WINDOWS}")

    handoff = pd.read_parquet(
        HANDOFF,
        columns=["cluster_id", "created_datetime_ist", "hour"],
    )
    peaks = pd.read_parquet(PEAK_WINDOWS)

    print("Peak window verification")
    print("Pipeline: P1 converts created_datetime UTC -> IST; M3 buckets on hour (hour_ist).")
    print(f"Handoff rows: {len(handoff):,} | Peak window clusters: {len(peaks):,}")

    for cid in clusters:
        verify_cluster(cid, handoff, peaks)

    print(f"\n{'=' * 72}")
    print("Peak hour distribution (all clusters, IST):")
    print(peaks["peak_hour"].value_counts().sort_index().head(24).to_string())


if __name__ == "__main__":
    main()
