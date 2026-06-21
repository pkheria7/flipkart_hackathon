"""
Daily master plan generator.

Builds a command-level daily plan per station with specific officer and
tow-truck assignments. The plan is sent to the head officer for approval.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from agents.llm_explainer import explain_hotspot
from agents.kannada_translator import translate_to_kannada
SCORED_PATH = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
OFFICERS_PATH = PROJECT_ROOT / "data" / "processed" / "synthetic_officers.csv"
TRUCKS_PATH = PROJECT_ROOT / "data" / "processed" / "synthetic_tow_trucks.csv"
PLAN_JSON = PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json"
PLAN_MD = PROJECT_ROOT / "reports" / "DAILY_MASTER_PLAN.md"


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in kilometers between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def load_rosters() -> tuple[pd.DataFrame, pd.DataFrame]:
    officers = pd.read_csv(OFFICERS_PATH) if OFFICERS_PATH.exists() else pd.DataFrame()
    trucks = pd.read_csv(TRUCKS_PATH) if TRUCKS_PATH.exists() else pd.DataFrame()
    return officers, trucks


def generate_master_plan(date_str: str | None = None, top_n: int = 5, use_llm: bool = True, llm_top_n: int = 3) -> dict:
    """Generate the daily master plan."""
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    scored = pd.read_parquet(SCORED_PATH)
    officers, trucks = load_rosters()

    # Determine day's weekday name for the plan header
    today = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")

    # Use all clusters; peak_window is a time-of-day window, not a day-of-week filter.
    # In production, recurrence patterns could be used to weight by day.
    todays = scored.copy().sort_values("roi_score", ascending=False)

    station_plans = []
    all_assignments = []

    for station, group in todays.groupby("assigned_station"):
        station_officers = officers[officers["assigned_station"] == station]
        station_trucks = trucks[trucks["assigned_station"] == station]

        top = group.head(top_n).reset_index(drop=True)

        assignments = []
        for i, (_, row) in enumerate(top.iterrows()):
            # Generate LLM explanations for top-N per station only
            explanation_en = ""
            explanation_kn = ""
            if use_llm and i < llm_top_n:
                cluster_data = {
                    "cluster_id": row["cluster_id"],
                    "road_class": row["road_class"],
                    "road_width_m": float(row["road_width_m"]),
                    "violation_count": int(row["violation_count"]),
                    "lcle_pct": float(row["lcle_pct"]),
                    "bci": float(row["bci"]),
                    "persistence": float(row["persistence"]),
                    "recurrence": float(row["recurrence"]),
                    "roi_score": float(row["roi_score"]),
                    "classification": row["classification"],
                    "peak_window": row["peak_window"],
                }
                try:
                    explanation_en = explain_hotspot(cluster_data)
                    explanation_kn = translate_to_kannada(explanation_en)
                except Exception as exc:
                    explanation_en = f"(LLM error: {exc})"
                    explanation_kn = ""
            officer = station_officers.iloc[i % len(station_officers)] if len(station_officers) else None
            truck = station_trucks.iloc[i % len(station_trucks)] if len(station_trucks) and row["classification"] == "STRUCTURAL" else None

            assignment = {
                "cluster_id": row["cluster_id"],
                "centroid_lat": round(row["centroid_lat"], 6),
                "centroid_lng": round(row["centroid_lng"], 6),
                "time_window": row["peak_window"],
                "roi_score": round(row["roi_score"], 2),
                "lcle_pct": round(row["lcle_pct"], 2),
                "bci": round(row["bci"], 4),
                "persistence": round(row["persistence"], 2),
                "recurrence": round(row["recurrence"], 4),
                "classification": row["classification"],
                "action": row["recommended_action"],
                "officer_id": officer["officer_id"] if officer is not None else "UNASSIGNED",
                "officer_name": officer["name"] if officer is not None else "Unassigned",
                "officer_email": officer["email"] if officer is not None else "",
                "tow_truck_id": truck["truck_id"] if truck is not None else None,
                "tow_truck_driver": truck["driver_name"] if truck is not None else None,
                "reason": (
                    f"ROI={row['roi_score']:.1f}, LCLE={row['lcle_pct']:.1f}%, "
                    f"BCI={row['bci']:.3f}, class={row['classification']}"
                ),
                "explanation_en": explanation_en,
                "explanation_kn": explanation_kn,
            }
            assignments.append(assignment)
            all_assignments.append(assignment)

        station_plans.append({
            "station": station,
            "date": date_str,
            "summary": f"{len(assignments)} patrol assignments",
            "assignments": assignments,
        })

    master_plan = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date": date_str,
        "day_of_week": today,
        "total_assignments": len(all_assignments),
        "stations": station_plans,
    }

    PLAN_JSON.parent.mkdir(parents=True, exist_ok=True)
    PLAN_JSON.write_text(json.dumps(master_plan, indent=2, default=str), encoding="utf-8")

    _write_markdown(master_plan)
    return master_plan


def _write_markdown(plan: dict) -> None:
    lines = [
        "# Daily Master Plan",
        "",
        f"**Date:** {plan['date']} ({plan['day_of_week']})",
        f"**Generated at:** {plan['generated_at']}",
        f"**Total assignments:** {plan['total_assignments']}",
        "",
        "This plan is pending approval by the head officer (ACP/JCT).",
        "Once approved, individual assignments will be dispatched to officers and tow-truck drivers.",
        "",
    ]

    for station_plan in plan["stations"]:
        lines.append(f"## Station: {station_plan['station']}")
        lines.append(f"*{station_plan['summary']}*")
        lines.append("")
        lines.append("| Time | Cluster | Officer | Tow Truck | Action | Reason |")
        lines.append("|------|---------|---------|-----------|--------|--------|")
        for a in station_plan["assignments"]:
            tow = a["tow_truck_id"] or "—"
            lines.append(
                f"| {a['time_window']} | {a['cluster_id']} | {a['officer_name']} ({a['officer_id']}) | {tow} | {a['action']} | {a['reason']} |"
            )
        lines.append("")

        # Add LLM explanations for top assignments
        explained = [a for a in station_plan["assignments"] if a.get("explanation_en")]
        if explained:
            lines.append("### Plain-language explanations")
            for a in explained:
                lines.append(f"- **{a['cluster_id']} (English):** {a['explanation_en']}")
                if a.get("explanation_kn"):
                    lines.append(f"- **{a['cluster_id']} (ಕನ್ನಡ):** {a['explanation_kn']}")
            lines.append("")

    PLAN_MD.parent.mkdir(parents=True, exist_ok=True)
    PLAN_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    plan = generate_master_plan()
    print(f"Generated master plan with {plan['total_assignments']} assignments")
