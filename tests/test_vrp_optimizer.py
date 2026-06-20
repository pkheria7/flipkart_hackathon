"""
Unit tests for M10 Patrol Route Optimizer.

Run with:
    pytest tests/test_vrp_optimizer.py -v

All tests use synthetic in-memory DataFrames — never touch real output files.
"""

from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
import pytest

# 06_optimize_vrp.py starts with a digit, so normal import fails.
# Use importlib to load it by path.
import importlib.util
import sys

_spec = importlib.util.spec_from_file_location(
    "pipeline_06_optimize_vrp",
    Path(__file__).resolve().parent.parent / "pipeline" / "06_optimize_vrp.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

haversine_km            = _mod.haversine_km
estimate_travel_minutes = _mod.estimate_travel_minutes
compute_route_rewards   = _mod.compute_route_rewards
optimize_station_route  = _mod.optimize_station_route
run_optimizer           = _mod.run_optimizer
validate_inputs         = _mod.validate_inputs
validate_routes         = _mod.validate_routes
_global_norms           = _mod._global_norms
REQUIRED_COLS           = _mod.REQUIRED_COLS


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_df(n: int = 10, station: str = "TEST_STATION") -> pd.DataFrame:
    """Minimal synthetic hotspot dataframe. All values kept within real column ranges."""
    rows = []
    for i in range(n):
        step = i / max(n - 1, 1)  # 0.0 → 1.0
        rows.append({
            "cluster_id":         f"C_T_{i}",
            "centroid_lat":       12.97 + i * 0.005,
            "centroid_lng":       77.58 + i * 0.005,
            "assigned_station":   station,
            "road_class":         "tertiary",
            "road_width_m":       6.0,
            "violation_count":    100 + i * 50,
            "lcle_pct":           10.0 + step * 80.0,   # 10 → 90
            "bci":                step * 0.9,            # 0 → 0.9
            "persistence":        1.0 + step * 99.0,    # 1 → 100
            "recurrence":         step,                  # 0 → 1
            "peak_window":        "09:00-11:00" if i % 2 == 0 else "11:00-13:00",
            "roi_score":          5.0 + step * 90.0,    # 5 → 95
            "classification":     "STRUCTURAL" if i % 3 == 0 else "RESPONSIVE",
            "recommended_action": (
                "Review geography first; apply patrol"
                if i % 4 == 0
                else "Targeted short-term patrol during peak window"
            ),
        })
    return pd.DataFrame(rows)


def _multi_station_df() -> pd.DataFrame:
    s1 = _make_df(8, "ALPHA")
    s2 = _make_df(5, "BETA")
    # Fix cluster_ids to avoid collision
    s2["cluster_id"] = ["C_B_" + str(i) for i in range(5)]
    return pd.concat([s1, s2], ignore_index=True)


# ---------------------------------------------------------------------------
# A. haversine_km
# ---------------------------------------------------------------------------

class TestHaversineKm:
    def test_same_point_is_zero(self) -> None:
        assert haversine_km(12.97, 77.58, 12.97, 77.58) == pytest.approx(0.0)

    def test_positive_distance(self) -> None:
        d = haversine_km(12.97, 77.58, 12.98, 77.59)
        assert d > 0

    def test_known_distance_approximate(self) -> None:
        # Bangalore to roughly 1 degree north ≈ 111 km
        d = haversine_km(12.0, 77.0, 13.0, 77.0)
        assert 110 < d < 115

    def test_symmetry(self) -> None:
        d1 = haversine_km(12.97, 77.58, 12.99, 77.60)
        d2 = haversine_km(12.99, 77.60, 12.97, 77.58)
        assert d1 == pytest.approx(d2)


# ---------------------------------------------------------------------------
# B. estimate_travel_minutes
# ---------------------------------------------------------------------------

class TestEstimateTravelMinutes:
    def test_zero_distance_zero_minutes(self) -> None:
        assert estimate_travel_minutes(0.0) == pytest.approx(0.0)

    def test_18km_takes_60min(self) -> None:
        assert estimate_travel_minutes(18.0, speed_kmph=18.0) == pytest.approx(60.0)

    def test_speed_scales_linearly(self) -> None:
        t1 = estimate_travel_minutes(10.0, 18.0)
        t2 = estimate_travel_minutes(10.0, 36.0)
        assert t1 == pytest.approx(t2 * 2)


# ---------------------------------------------------------------------------
# C. validate_inputs
# ---------------------------------------------------------------------------

class TestValidateInputs:
    def test_valid_df_all_pass(self) -> None:
        df = _make_df()
        checks = validate_inputs(df)
        failed = [n for n, ok, _ in checks if not ok]
        assert not failed, f"Unexpected failures: {failed}"

    def test_missing_column_fails(self) -> None:
        df = _make_df().drop(columns=["roi_score"])
        checks = validate_inputs(df)
        assert any(n == "required_columns_present" and not ok for n, ok, _ in checks)

    def test_roi_out_of_range_fails(self) -> None:
        df = _make_df()
        df.loc[0, "roi_score"] = 150.0
        checks = validate_inputs(df)
        assert any(n == "roi_score_valid_range" and not ok for n, ok, _ in checks)


# ---------------------------------------------------------------------------
# D. compute_route_rewards
# ---------------------------------------------------------------------------

class TestComputeRouteRewards:
    def test_adds_route_reward_column(self) -> None:
        df = _make_df()
        norms = _global_norms(df)
        df2 = compute_route_rewards(df, norms)
        assert "route_reward" in df2.columns

    def test_adds_review_required_column(self) -> None:
        df = _make_df()
        norms = _global_norms(df)
        df2 = compute_route_rewards(df, norms)
        assert "review_required" in df2.columns

    def test_structural_bonus_applied(self) -> None:
        df = _make_df(2)
        df.loc[0, "classification"] = "STRUCTURAL"
        df.loc[1, "classification"] = "RESPONSIVE"
        # Make rows identical except classification
        for col in ["roi_score", "bci", "lcle_pct", "persistence"]:
            df.loc[1, col] = df.loc[0, col]
        norms = _global_norms(df)
        df2 = compute_route_rewards(df, norms)
        assert df2.loc[0, "route_reward"] > df2.loc[1, "route_reward"]

    def test_review_required_detects_phrase(self) -> None:
        df = _make_df()
        norms = _global_norms(df)
        df2 = compute_route_rewards(df, norms)
        # Rows with "Review geography first" in recommended_action should be True
        review_mask = df["recommended_action"].str.contains("Review geography first", case=False)
        assert (df2["review_required"] == review_mask).all()

    def test_reward_bounded(self) -> None:
        df = _make_df(20)
        norms = _global_norms(df)
        df2 = compute_route_rewards(df, norms)
        # Max possible = 0.55 + 0.20 + 0.15 + 0.10 + 0.05 = 1.05
        assert df2["route_reward"].max() <= 1.06
        assert df2["route_reward"].min() >= 0.0


# ---------------------------------------------------------------------------
# E. optimize_station_route
# ---------------------------------------------------------------------------

class TestOptimizeStationRoute:
    def _run(self, n=10, max_stops=8, max_dur=180, service=10, speed=18, pool=25):
        df = _make_df(n)
        norms = _global_norms(df)
        df = compute_route_rewards(df, norms)
        return optimize_station_route(df, max_stops, max_dur, service, speed, pool)

    def test_returns_at_least_one_stop(self) -> None:
        stops, _ = self._run()
        assert len(stops) >= 1

    def test_respects_max_stops(self) -> None:
        stops, _ = self._run(n=20, max_stops=4, pool=20)
        assert len(stops) <= 4

    def test_respects_time_budget(self) -> None:
        stops, summary = self._run(max_stops=8, max_dur=30, service=10)
        assert summary["estimated_total_minutes"] <= 30.0 + 0.1  # small float tolerance

    def test_no_duplicate_stops(self) -> None:
        stops, _ = self._run(n=20, max_stops=8, pool=20)
        ids = [s["cluster_id"] for s in stops]
        assert len(ids) == len(set(ids))

    def test_sequence_numbers_sequential(self) -> None:
        stops, _ = self._run()
        assert [s["sequence"] for s in stops] == list(range(1, len(stops) + 1))

    def test_first_stop_has_zero_leg(self) -> None:
        stops, _ = self._run()
        assert stops[0]["estimated_leg_km"] == 0.0
        assert stops[0]["estimated_leg_minutes"] == 0.0

    def test_summary_has_required_keys(self) -> None:
        _, summary = self._run()
        required = {
            "stop_count", "estimated_travel_minutes", "estimated_service_minutes",
            "estimated_total_minutes", "total_route_reward", "avg_roi_score",
            "route_primary_peak_window", "peak_alignment_score", "review_required_count",
        }
        assert required.issubset(set(summary.keys()))

    def test_single_candidate_makes_single_stop(self) -> None:
        df = _make_df(1)
        norms = _global_norms(df)
        df = compute_route_rewards(df, norms)
        stops, _ = optimize_station_route(df, 8, 180, 10, 18, 25)
        assert len(stops) == 1


# ---------------------------------------------------------------------------
# F. run_optimizer
# ---------------------------------------------------------------------------

class TestRunOptimizer:
    def test_generates_route_per_station(self) -> None:
        df = _multi_station_df()
        routes = run_optimizer(df)
        stations = set(df["assigned_station"].unique())
        route_stations = {r["assigned_station"] for r in routes}
        assert route_stations == stations

    def test_station_filter(self) -> None:
        df = _multi_station_df()
        routes = run_optimizer(df, station_filter="ALPHA")
        assert len(routes) == 1
        assert routes[0]["assigned_station"] == "ALPHA"

    def test_invalid_station_raises(self) -> None:
        df = _multi_station_df()
        with pytest.raises(ValueError, match="not found"):
            run_optimizer(df, station_filter="NONEXISTENT_STATION")

    def test_routes_have_route_id(self) -> None:
        df = _multi_station_df()
        routes = run_optimizer(df)
        assert all("route_id" in r and r["route_id"].startswith("ROUTE_") for r in routes)

    def test_routes_have_stops_list(self) -> None:
        df = _multi_station_df()
        routes = run_optimizer(df)
        assert all(isinstance(r["stops"], list) and len(r["stops"]) > 0 for r in routes)


# ---------------------------------------------------------------------------
# G. validate_routes
# ---------------------------------------------------------------------------

class TestValidateRoutes:
    def _get_routes(self) -> list[dict]:
        df = _multi_station_df()
        return run_optimizer(df)

    def test_all_checks_pass_for_valid_routes(self) -> None:
        routes = self._get_routes()
        checks = validate_routes(routes, max_stops=8, max_duration_minutes=180, station_count=2)
        failed = [n for n, ok, _ in checks if not ok]
        assert not failed, f"Unexpected failures: {failed}"

    def test_json_schema_has_metadata_and_routes(self) -> None:
        df = _multi_station_df()
        routes = run_optimizer(df)
        metadata = {
            "input_file": "test", "input_rows": len(df),
            "generated_at_ist": "2026-01-01T00:00:00+05:30",
            "routing_mode": "haversine_fallback",
            "max_route_duration_minutes": 180,
            "max_stops_per_route": 8,
            "service_minutes_per_stop": 10,
            "speed_kmph": 18.0,
            "candidate_pool_per_station": 25,
            "station_count": len(routes),
            "route_count": len(routes),
        }
        import json
        payload = json.dumps({"metadata": metadata, "routes": routes})
        loaded = json.loads(payload)
        assert "metadata" in loaded
        assert "routes" in loaded
        assert isinstance(loaded["routes"], list)
