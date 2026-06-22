"""
Daily master plan generator.

Builds a command-level daily plan per station with specific officer and
tow-truck assignments, M10 patrol-route ordering, and M15 infra escalation flags.

Priority:
  1. Use M10 patrol_routes.json stop sequence per station (VRP-optimised).
  2. Fall back to top-ROI from scored_hotspots.parquet if M10 data is absent.
  3. Flag clusters that are escalation-ready in M15 infra_assessment_summary.csv.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from agents.llm_explainer    import explain_hotspot
from agents.kannada_translator import translate_to_kannada

SCORED_PATH   = PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet"
OFFICERS_PATH = PROJECT_ROOT / "data" / "processed" / "synthetic_officers.csv"
TRUCKS_PATH   = PROJECT_ROOT / "data" / "processed" / "synthetic_tow_trucks.csv"
M10_ROUTES    = PROJECT_ROOT / "data" / "outputs" / "patrol_routes.json"
M15_SUMMARY   = PROJECT_ROOT / "data" / "outputs" / "infra_assessment_summary.csv"
PLAN_JSON     = PROJECT_ROOT / "data" / "outputs" / "daily_master_plan.json"
PLAN_MD       = PROJECT_ROOT / "reports" / "DAILY_MASTER_PLAN.md"

_IST = timezone(timedelta(hours=5, minutes=30))


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in kilometres between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Roster loading & validation
# ---------------------------------------------------------------------------

def load_rosters(allow_unassigned: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Load officer and tow-truck rosters.

    If files are missing and allow_unassigned=False (the default), print
    the commands needed to generate them and raise FileNotFoundError.
    If allow_unassigned=True, return empty DataFrames (assigns UNASSIGNED).
    """
    missing: list[str] = []
    if not OFFICERS_PATH.exists():
        missing.append(f"  {OFFICERS_PATH.relative_to(PROJECT_ROOT)}")
    if not TRUCKS_PATH.exists():
        missing.append(f"  {TRUCKS_PATH.relative_to(PROJECT_ROOT)}")

    if missing:
        msg = "\n".join([
            "Roster files not found:",
            *missing,
            "",
            "Generate them with:",
            "  python demo/synth_officers.py",
            "  python demo/synth_tow_trucks.py",
        ])
        if allow_unassigned:
            print(f"[PLAN] WARNING — {msg}")
            print("[PLAN] Proceeding with UNASSIGNED placeholders (allow_unassigned=True).")
            return pd.DataFrame(), pd.DataFrame()
        raise FileNotFoundError(msg)

    officers = pd.read_csv(OFFICERS_PATH)
    trucks   = pd.read_csv(TRUCKS_PATH)
    return officers, trucks


# ---------------------------------------------------------------------------
# M10 patrol-routes loading
# ---------------------------------------------------------------------------

def _load_m10_routes() -> tuple[dict[str, dict], str]:
    """
    Return (station → route dict, global_routing_mode) from patrol_routes.json.

    global_routing_mode comes from metadata.routing_mode_used in the JSON file;
    it is "graph" when OSM graph routing was used, "haversine" otherwise.
    Returns ({}, "haversine") if the file is missing.
    """
    if not M10_ROUTES.exists():
        return {}, "haversine"
    try:
        data = json.loads(M10_ROUTES.read_text(encoding="utf-8"))
        global_mode = data.get("metadata", {}).get("routing_mode_used", "haversine")
        return {r["assigned_station"]: r for r in data.get("routes", [])}, global_mode
    except Exception as exc:
        print(f"[PLAN] Could not load M10 routes ({exc}); falling back to top-ROI.")
        return {}, "haversine"


# ---------------------------------------------------------------------------
# M15 infra escalation loading
# ---------------------------------------------------------------------------

def _load_m15_summary() -> dict[str, dict]:
    """
    Return a dict mapping cluster_id → M15 infra summary row.

    Returns {} if the file is missing (all clusters get infra_escalation_ready=False).
    """
    if not M15_SUMMARY.exists():
        return {}
    try:
        df = pd.read_csv(M15_SUMMARY)
        result: dict[str, dict] = {}
        for _, row in df.iterrows():
            result[str(row["cluster_id"])] = {
                "infra_escalation_ready": int(row.get("infra_escalation_ready", 0)),
                "infra_dominant_cause":   str(row.get("infra_dominant_cause", "")),
                "infra_suggested_fix":    str(row.get("infra_suggested_fix", "")),
                "infra_structural_boost": int(row.get("infra_structural_boost", 0)),
            }
        return result
    except Exception as exc:
        print(f"[PLAN] Could not load M15 summary ({exc}); infra flags will be absent.")
        return {}


# ---------------------------------------------------------------------------
# Agency mapping (mirrors M15 backend)
# ---------------------------------------------------------------------------

_AGENCY_MAP = {
    "police_enforcement_only":    "BTP",
    "install_no_parking_sign":    "BBMP",
    "repaint_curb_marking":       "BBMP",
    "add_bollards_or_barriers":   "BBMP",
    "improve_lighting":           "BBMP",
    "remove_encroachment":        "BBMP",
    "create_loading_zone":        "JOINT_BBMP_BTP",
    "create_parking_bay":         "JOINT_BBMP_BTP",
    "redesign_junction_edge":     "JOINT_BBMP_BTP",
    "joint_bbmp_btp_inspection":  "JOINT_BBMP_BTP",
}


def _infra_flags(cluster_id: str, m15: dict[str, dict]) -> dict:
    """Return M15 infra fields for a cluster, defaulting to safe 'no escalation'."""
    if cluster_id not in m15:
        return {
            "infra_escalation_ready": False,
            "infra_dominant_cause":   None,
            "infra_suggested_fix":    None,
            "recommended_agency":     None,
        }
    m = m15[cluster_id]
    fix    = m.get("infra_suggested_fix") or ""
    agency = _AGENCY_MAP.get(fix)
    return {
        "infra_escalation_ready": bool(m.get("infra_escalation_ready", 0)),
        "infra_dominant_cause":   m.get("infra_dominant_cause") or None,
        "infra_suggested_fix":    fix or None,
        "recommended_agency":     agency,
    }


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

def _get_explanation(row: pd.Series, use_llm: bool) -> tuple[str, str]:
    if not use_llm:
        return "", ""
    cluster_data = {
        "cluster_id":      row["cluster_id"],
        "road_class":      row["road_class"],
        "road_width_m":    float(row["road_width_m"]),
        "violation_count": int(row["violation_count"]),
        "lcle_pct":        float(row["lcle_pct"]),
        "bci":             float(row["bci"]),
        "persistence":     float(row["persistence"]),
        "recurrence":      float(row["recurrence"]),
        "roi_score":       float(row["roi_score"]),
        "classification":  row["classification"],
        "peak_window":     row["peak_window"],
    }
    try:
        en = explain_hotspot(cluster_data)
        kn = translate_to_kannada(en)
    except Exception as exc:
        en = f"(LLM error: {exc})"
        kn = ""
    return en, kn


# ---------------------------------------------------------------------------
# Core plan builder
# ---------------------------------------------------------------------------

def generate_master_plan(
    date_str:        Optional[str] = None,
    run_id:          Optional[str] = None,
    top_n:           int  = 5,
    use_llm:         bool = True,
    llm_top_n:       int  = 3,
    allow_unassigned: bool = False,
) -> dict:
    """
    Generate the daily master plan.

    Parameters
    ----------
    date_str:         Plan date (YYYY-MM-DD). Defaults to today (IST).
    run_id:           Scheduler run ID; embedded in plan for traceability.
    top_n:            Max stops per station (used only when M10 route absent).
    use_llm:          If True, call Groq LLaMA for plain-English explanations.
    llm_top_n:        Number of top stops per station to generate LLM explanations for.
    allow_unassigned: If True, silently use UNASSIGNED when roster files are missing.
                      Default False — raises FileNotFoundError with fix instructions.

    Returns the plan dict and also writes daily_master_plan.json + DAILY_MASTER_PLAN.md.
    """
    now_ist_dt = datetime.now(_IST)
    if date_str is None:
        date_str = now_ist_dt.strftime("%Y-%m-%d")
    today   = datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    now_ist = now_ist_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")

    # Auto-generate run_id from IST timestamp if caller did not supply one
    if run_id is None:
        run_id = now_ist_dt.strftime("%Y%m%d_%H%M%S")

    # Sync run_id to agent_state so all outputs agree
    from agents.state_manager import update_run_id
    update_run_id(run_id)

    # --- Load data sources ---
    if not SCORED_PATH.exists():
        raise FileNotFoundError(
            f"scored_hotspots.parquet not found at {SCORED_PATH}. "
            "Run the scoring pipeline first."
        )
    scored = pd.read_parquet(SCORED_PATH)
    officers, trucks = load_rosters(allow_unassigned=allow_unassigned)

    m10_routes, m10_global_routing_mode = _load_m10_routes()
    m15_data   = _load_m15_summary()

    using_m10   = bool(m10_routes)
    using_m15   = bool(m15_data)

    if using_m10:
        print(f"[PLAN] M10 patrol routes loaded — {len(m10_routes)} stations "
              f"(routing_mode={m10_global_routing_mode}).")
    else:
        print(f"[PLAN] M10 patrol_routes.json not found — falling back to top-ROI ordering.")

    if using_m15:
        esc_ready = sum(1 for v in m15_data.values() if v.get("infra_escalation_ready"))
        print(f"[PLAN] M15 infra summary loaded — {len(m15_data)} clusters, "
              f"{esc_ready} escalation-ready.")
    else:
        print("[PLAN] M15 infra_assessment_summary.csv not found — infra flags will be absent.")

    # Scored hotspots indexed by cluster_id for quick lookup
    scored_index = {str(r["cluster_id"]): r for _, r in scored.iterrows()}

    station_plans  = []
    all_assignments = []

    # All stations: union of M10 stations and scored-hotspot stations
    all_stations = sorted(set(scored["assigned_station"].dropna().unique()))

    for station in all_stations:
        station_officers = (
            officers[officers["assigned_station"] == station]
            if len(officers) else pd.DataFrame()
        )
        station_trucks = (
            trucks[trucks["assigned_station"] == station]
            if len(trucks) else pd.DataFrame()
        )

        # --- Build stop list: M10 route order preferred, else top-ROI ---
        route_meta: dict = {}
        if station in m10_routes:
            m10_route  = m10_routes[station]
            stops_raw  = m10_route.get("stops", [])
            routing_source = "m10_vrp"
            route_meta = {
                "route_id":                  m10_route.get("route_id"),
                "estimated_route_km":        m10_route.get("estimated_route_km"),
                "estimated_travel_minutes":  m10_route.get("estimated_travel_minutes"),
                "estimated_service_minutes": m10_route.get("estimated_service_minutes"),
                "estimated_total_minutes":   m10_route.get("estimated_total_minutes"),
                "route_primary_peak_window": m10_route.get("route_primary_peak_window"),
                "avg_roi_score":             m10_route.get("avg_roi_score"),
                "m10_routing_mode":          m10_global_routing_mode,
            }
            # Build rows from M10 stop list, enriching from scored index
            top_rows: list[pd.Series] = []
            for stop in stops_raw:
                cid = str(stop.get("cluster_id", ""))
                if cid in scored_index:
                    row_enriched = dict(scored_index[cid])
                    # Prefer M10's per-stop travel data
                    row_enriched["_stop_sequence"]        = stop.get("sequence")
                    row_enriched["_leg_km"]               = stop.get("estimated_leg_km")
                    row_enriched["_leg_minutes"]          = stop.get("estimated_leg_minutes")
                    row_enriched["_cumulative_minutes"]   = stop.get("cumulative_minutes")
                    top_rows.append(pd.Series(row_enriched))
        else:
            routing_source = "top_roi_fallback"
            station_scored = (
                scored[scored["assigned_station"] == station]
                .sort_values("roi_score", ascending=False)
                .head(top_n)
                .reset_index(drop=True)
            )
            top_rows = [row for _, row in station_scored.iterrows()]
            route_meta = {}

        if not top_rows:
            continue

        assignments: list[dict] = []
        for i, row in enumerate(top_rows):
            cid = str(row["cluster_id"])

            # LLM explanations only for top-llm_top_n per station
            en, kn = _get_explanation(row, use_llm=(use_llm and i < llm_top_n))

            officer = (
                station_officers.iloc[i % len(station_officers)]
                if len(station_officers) else None
            )
            is_structural = str(row.get("classification", "")) == "STRUCTURAL"
            truck = (
                station_trucks.iloc[i % len(station_trucks)]
                if (len(station_trucks) and is_structural) else None
            )

            infra = _infra_flags(cid, m15_data)

            a: dict = {
                # --- Identity ---
                "cluster_id":   cid,
                "centroid_lat": round(float(row["centroid_lat"]), 6),
                "centroid_lng": round(float(row["centroid_lng"]), 6),
                "time_window":  row["peak_window"],

                # --- Scores ---
                "roi_score":    round(float(row["roi_score"]), 2),
                "lcle_pct":     round(float(row["lcle_pct"]), 2),
                "bci":          round(float(row["bci"]), 4),
                "persistence":  round(float(row["persistence"]), 2),
                "recurrence":   round(float(row["recurrence"]), 4),

                # --- Classification ---
                "classification": row["classification"],
                "action":         row["recommended_action"],

                # --- Assignment ---
                "officer_id":        officer["officer_id"]   if officer is not None else "UNASSIGNED",
                "officer_name":      officer["name"]         if officer is not None else "Unassigned",
                "officer_email":     officer["email"]        if officer is not None else "",
                "tow_truck_id":      truck["truck_id"]       if truck is not None else None,
                "tow_truck_driver":  truck["driver_name"]    if truck is not None else None,

                # --- Routing source ---
                "routing_source": routing_source,

                # --- M10 per-stop travel info (None when falling back to ROI) ---
                "stop_sequence":      row.get("_stop_sequence"),
                "leg_km":             row.get("_leg_km"),
                "leg_minutes":        row.get("_leg_minutes"),
                "cumulative_minutes": row.get("_cumulative_minutes"),

                # --- M15 infra flags ---
                **infra,

                # --- Human-readable reason ---
                "reason": (
                    f"ROI={row['roi_score']:.1f}, LCLE={row['lcle_pct']:.1f}%, "
                    f"BCI={row['bci']:.3f}, class={row['classification']}"
                ),

                # --- LLM explanations ---
                "explanation_en": en,
                "explanation_kn": kn,
            }
            assignments.append(a)
            all_assignments.append(a)

        station_plan: dict = {
            "station":        station,
            "date":           date_str,
            "summary":        f"{len(assignments)} patrol assignments",
            "routing_source": routing_source,
            "assignments":    assignments,
        }
        if route_meta:
            station_plan["m10_route_meta"] = route_meta

        station_plans.append(station_plan)

    master_plan = {
        "run_id":              run_id,
        "generated_at":        datetime.now(timezone.utc).isoformat(),
        "generated_at_ist":    now_ist,
        "date":                date_str,
        "day_of_week":         today,
        "total_assignments":   len(all_assignments),
        "routing_source":      "m10_vrp" if using_m10 else "top_roi_fallback",
        "m10_wired":           using_m10,
        "m10_routing_mode":    m10_global_routing_mode if using_m10 else None,
        "m15_wired":           using_m15,
        "stations":            station_plans,
    }

    PLAN_JSON.parent.mkdir(parents=True, exist_ok=True)
    PLAN_JSON.write_text(json.dumps(master_plan, indent=2, default=str), encoding="utf-8")
    _write_markdown(master_plan)

    print(
        f"[PLAN] Generated master plan: {len(station_plans)} stations, "
        f"{len(all_assignments)} assignments, "
        f"routing={'M10-VRP' if using_m10 else 'top-ROI-fallback'}, "
        f"M15={'yes' if using_m15 else 'no'}."
    )
    return master_plan


# ---------------------------------------------------------------------------
# Markdown writer
# ---------------------------------------------------------------------------

def _write_markdown(plan: dict) -> None:
    routing_note = (
        "Routes follow M10 VRP-optimised stop order."
        if plan.get("m10_wired")
        else "Routes use top-ROI fallback (M10 patrol_routes.json not found)."
    )
    m15_note = (
        "M15 infra escalation flags are included."
        if plan.get("m15_wired")
        else "M15 infra flags absent (infra_assessment_summary.csv not found)."
    )

    lines = [
        "# Daily Master Plan",
        "",
        f"**Date:** {plan['date']} ({plan['day_of_week']})",
        f"**Generated at (IST):** {plan.get('generated_at_ist', plan['generated_at'])}",
        f"**Run ID:** {plan.get('run_id', 'N/A')}",
        f"**Total assignments:** {plan['total_assignments']}",
        "",
        f"**Routing:** {routing_note}",
        f"**Infra:** {m15_note}",
        "",
        "This plan is pending approval by the head officer (ACP/JCT).",
        "Once approved, individual assignments will be dispatched to officers and tow-truck drivers.",
        "",
    ]

    for sp in plan["stations"]:
        lines.append(f"## Station: {sp['station']}")
        lines.append(f"*{sp['summary']} — routing: {sp['routing_source']}*")

        if sp.get("m10_route_meta"):
            m = sp["m10_route_meta"]
            lines.append(
                f"*M10 route: {m.get('route_id')} | "
                f"{m.get('estimated_route_km', '?')} km | "
                f"{m.get('estimated_total_minutes', '?')} min total | "
                f"peak: {m.get('route_primary_peak_window', '?')}*"
            )
        lines.append("")
        lines.append("| Seq | Time | Cluster | Officer | Tow | Action | Infra Esc. | Reason |")
        lines.append("|-----|------|---------|---------|-----|--------|------------|--------|")

        for a in sp["assignments"]:
            tow    = a["tow_truck_id"] or "—"
            seq    = a.get("stop_sequence") or "—"
            esc    = "🚨 YES" if a.get("infra_escalation_ready") else "—"
            lines.append(
                f"| {seq} | {a['time_window']} | {a['cluster_id']} "
                f"| {a['officer_name']} ({a['officer_id']}) "
                f"| {tow} | {a['action']} | {esc} | {a['reason']} |"
            )
        lines.append("")

        # Infra escalation notes
        esc_assignments = [a for a in sp["assignments"] if a.get("infra_escalation_ready")]
        if esc_assignments:
            lines.append("### Infra Escalation Alerts")
            for a in esc_assignments:
                lines.append(
                    f"- **{a['cluster_id']}** — Cause: `{a.get('infra_dominant_cause')}` | "
                    f"Fix: `{a.get('infra_suggested_fix')}` | "
                    f"Agency: **{a.get('recommended_agency', 'JOINT_BBMP_BTP')}**"
                )
            lines.append("")

        # LLM explanations
        explained = [a for a in sp["assignments"] if a.get("explanation_en")]
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
    plan = generate_master_plan(use_llm=False)
    print(f"Generated master plan with {plan['total_assignments']} assignments")
    print(f"  M10 wired: {plan['m10_wired']}")
    print(f"  M15 wired: {plan['m15_wired']}")
    print(f"  Routing:   {plan['routing_source']}")
