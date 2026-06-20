"""
Run Phase 1: P1 Data Cleaning + P2 Hotspot Clustering

Executes pipeline/01_clean.py followed by pipeline/02_cluster.py and prints
all generated output paths.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    print("=" * 60)
    print("Phase 1: P1 Cleaning + P2 Clustering")
    print("=" * 60)

    pipeline_dir = Path(__file__).resolve().parent
    root_dir = pipeline_dir.parent

    # P1
    clean_mod = load_module("pipeline_01_clean", pipeline_dir / "01_clean.py")
    cleaned_df, p1_summary = clean_mod.clean_data()
    raw_rows = p1_summary["raw_rows"]
    cleaned_rows = p1_summary["cleaned_rows"]
    dropped_rows = p1_summary["dropped_rows"]

    print("\n" + "=" * 60)
    # P2
    cluster_mod = load_module("pipeline_02_cluster", pipeline_dir / "02_cluster.py")
    p2_summary = cluster_mod.cluster_data(
        raw_rows=raw_rows,
        cleaned_rows=cleaned_rows,
        dropped_rows=dropped_rows,
        p1_summary=p1_summary,
    )

    print("\n" + "=" * 60)
    print("Phase 1 complete. Outputs:")
    print("=" * 60)
    outputs = {
        "cleaned_violations_parquet": root_dir / "data" / "processed" / "cleaned_violations.parquet",
        "cleaned_violations_csv": root_dir / "data" / "processed" / "cleaned_violations.csv",
        "clustered_violations_parquet": root_dir / "data" / "processed" / "clustered_violations.parquet",
        "clustered_violations_csv": root_dir / "data" / "processed" / "clustered_violations.csv",
        "cluster_summary_parquet": root_dir / "data" / "processed" / "cluster_summary.parquet",
        "cluster_summary_csv": root_dir / "data" / "processed" / "cluster_summary.csv",
        "cluster_handoff_for_prakhar_parquet": root_dir / "data" / "processed" / "cluster_handoff_for_prakhar.parquet",
        "cluster_handoff_for_prakhar_csv": root_dir / "data" / "processed" / "cluster_handoff_for_prakhar.csv",
        "handover_report": root_dir / "reports" / "P1_P2_HANDOVER_REPORT.md",
        "data_quality_summary": root_dir / "reports" / "P1_P2_DATA_QUALITY_SUMMARY.md",
        "cluster_sanity_map": root_dir / "reports" / "cluster_sanity_map.html",
    }
    for name, path in outputs.items():
        status = "EXISTS" if path.exists() else "MISSING"
        print(f"  [{status}] {name}: {path}")

    all_ok = all(p.exists() for p in outputs.values())
    print("\n" + ("ALL OUTPUTS CREATED" if all_ok else "SOME OUTPUTS MISSING"))

    print("\nSummary:")
    print(json.dumps({
        "raw_rows": raw_rows,
        "cleaned_rows": cleaned_rows,
        "dropped_rows": dropped_rows,
        **p2_summary,
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
