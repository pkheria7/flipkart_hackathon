"""
Pipeline runner for the agent.

Calls the existing pipeline modules in order and returns a summary.
Snapshots pre-pipeline outputs before any destructive stage.
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def _load_module(module_name: str, file_path: Path):
    import importlib.util
    spec   = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_full_pipeline(run_id: Optional[str] = None) -> dict:
    """
    Run the entire pipeline from cleaning to final scoring.

    Snapshots pre-pipeline outputs under run_snapshots/<run_id>/pre_pipeline/
    BEFORE any destructive write (P1 clean overwrites processed outputs).
    If run_id is None, generates one from timestamp.
    """
    from agents.state_manager import snapshot_pre_pipeline, record_run_start

    if run_id is None:
        run_id = record_run_start()

    # Snapshot BEFORE P1 overwrites processed outputs
    snapshot_pre_pipeline(run_id)

    results: dict = {"status": "success", "steps": [], "run_id": run_id}
    timing: list[tuple[str, float]] = []

    import time

    try:
        # P1: clean data
        t0 = time.time()
        clean_mod = _load_module("pipeline_01_clean", PROJECT_ROOT / "pipeline" / "01_clean.py")
        cleaned_df, p1_summary = clean_mod.clean_data()
        raw_rows     = p1_summary["raw_rows"]
        cleaned_rows = p1_summary["cleaned_rows"]
        dropped_rows = p1_summary["dropped_rows"]
        timing.append(("P1_Clean", time.time() - t0))

        # P2: cluster
        t0 = time.time()
        cluster_mod = _load_module("pipeline_02_cluster", PROJECT_ROOT / "pipeline" / "02_cluster.py")
        cluster_mod.cluster_data(
            raw_rows=raw_rows,
            cleaned_rows=cleaned_rows,
            dropped_rows=dropped_rows,
            p1_summary=p1_summary,
        )
        timing.append(("P2_Cluster", time.time() - t0))

        # P3a: peak windows
        t0 = time.time()
        p3a_mod = _load_module("pipeline_03a_peak", PROJECT_ROOT / "pipeline" / "03a_peak_windows.py")
        p3a_mod.run()
        timing.append(("M3_PeakWindows", time.time() - t0))

        # P3b: classify hotspots
        t0 = time.time()
        p3b_mod = _load_module("pipeline_03b_classify", PROJECT_ROOT / "pipeline" / "03b_classify_hotspots.py")
        p3b_mod.run()
        timing.append(("M4_Classify", time.time() - t0))

        # P3: jurisdiction assignment
        t0 = time.time()
        p3_mod = _load_module("pipeline_03_jurisdiction", PROJECT_ROOT / "pipeline" / "03_jurisdiction.py")
        p3_mod.run()
        timing.append(("M18_Jurisdiction", time.time() - t0))

        # P3c: merge Prakhar features
        t0 = time.time()
        p3c_mod = _load_module("pipeline_03c_merge", PROJECT_ROOT / "pipeline" / "03c_merge_prakhar_features.py")
        p3c_mod.run()
        timing.append(("Prakhar_Merge", time.time() - t0))

        # P4: OSM enrichment
        t0 = time.time()
        p4_mod = _load_module("pipeline_04_enrich_osm", PROJECT_ROOT / "pipeline" / "04_enrich_osm.py")
        p4_mod.enrich_osm()
        timing.append(("P4_OSM", time.time() - t0))

        # M2: LCLE scoring
        t0 = time.time()
        m2_mod = _load_module("pipeline_05_score", PROJECT_ROOT / "pipeline" / "05_score.py")
        m2_mod.score_lcle()
        timing.append(("M2_LCLE", time.time() - t0))

        # M7: BCI
        t0 = time.time()
        m7_mod = _load_module("pipeline_m7_bci", PROJECT_ROOT / "pipeline" / "m7_bci.py")
        m7_mod.compute_bci()
        timing.append(("M7_BCI", time.time() - t0))

        # M1: ROI ranker
        t0 = time.time()
        m1_mod = _load_module("pipeline_m1_roi", PROJECT_ROOT / "pipeline" / "m1_roi_ranker.py")
        m1_mod.run_m1()
        timing.append(("M1_ROI", time.time() - t0))

        results["steps"]         = [{"step": s, "seconds": round(t, 2)} for s, t in timing]
        results["total_seconds"] = round(sum(t for _, t in timing), 2)

    except Exception as exc:
        results["status"]    = "failed"
        results["error"]     = str(exc)
        results["traceback"] = traceback.format_exc()
        results["steps"]     = [{"step": s, "seconds": round(t, 2)} for s, t in timing]

    return results


if __name__ == "__main__":
    import json
    summary = run_full_pipeline()
    print(json.dumps(summary, indent=2, default=str))
