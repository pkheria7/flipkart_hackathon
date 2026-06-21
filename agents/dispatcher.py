"""
Dispatcher for approved daily plans.

Sends the master plan to the head officer and individual assignments to
officers and tow-truck drivers.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from agents.mailer import send_email
from agents.state_manager import record_dispatch

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _format_officer_email(officer_id: str, name: str, station: str, assignments: list, date: str) -> tuple[str, str]:
    subject = f"[BTP Parking Agent] Your Patrol Assignments — {date}"

    lines = [
        f"Dear {name},",
        "",
        f"Your patrol assignments for {date} at {station} station:",
        "",
    ]
    for i, a in enumerate(assignments, 1):
        lines.append(f"{i}. {a['time_window']} — {a['cluster_id']}")
        lines.append(f"   Action: {a['action']}")
        lines.append(f"   Reason: {a['reason']}")
        if a.get("explanation_en"):
            lines.append(f"   Why: {a['explanation_en']}")
        if a.get("explanation_kn"):
            lines.append(f"   ಏಕೆ (Kannada): {a['explanation_kn']}")
        lines.append(f"   Location: {a['centroid_lat']:.6f}, {a['centroid_lng']:.6f}")
        lines.append("")
    lines.append("Please report the outcome after each patrol.")
    lines.append("")
    lines.append("Reply with: TOWED / WARNED / RECURRED / NONE")

    return subject, "\n".join(lines)


def _format_truck_email(truck_id: str, driver: str, station: str, assignments: list, date: str) -> tuple[str, str]:
    subject = f"[BTP Parking Agent] Towing Tasks — {date}"

    lines = [
        f"Dear {driver},",
        "",
        f"Your towing tasks for {date} at {station} station:",
        "",
    ]
    for i, a in enumerate(assignments, 1):
        lines.append(f"{i}. {a['time_window']} — {a['cluster_id']} — Officer {a['officer_name']}")
        lines.append(f"   Location: {a['centroid_lat']:.6f}, {a['centroid_lng']:.6f}")
        lines.append("")

    return subject, "\n".join(lines)


def _format_head_email(plan: dict) -> tuple[str, str]:
    date = plan["date"]
    subject = f"[BTP Parking Agent] Daily Master Plan for Approval — {date}"

    lines = [
        "Dear Head Officer,",
        "",
        f"The parking intelligence agent has generated the daily master plan for {date}.",
        f"Total assignments: {plan['total_assignments']}",
        f"Stations covered: {len(plan['stations'])}",
        "",
        "Summary by station:",
    ]
    for sp in plan["stations"]:
        lines.append(f"- {sp['station']}: {sp['summary']}")
    lines.append("")
    lines.append("Please review and approve or revise the plan.")
    lines.append("In production, this email would contain Approve/Revise links.")

    return subject, "\n".join(lines)


def dispatch_head_officer(plan: dict, dry_run: bool = True) -> dict:
    """Send the master plan to the head officer."""
    head_email = os.getenv("HEAD_OFFICER_EMAIL", "head.officer@example.com")
    subject, body = _format_head_email(plan)
    result = send_email(head_email, subject, body, dry_run=dry_run)
    return {"recipient_type": "head_officer", **result}


def dispatch_approved_plan(plan: dict, dry_run: bool = True) -> list[dict]:
    """Dispatch individual assignments to officers and tow-truck drivers."""
    results = []

    # Group assignments by officer
    officer_map = {}
    truck_map = {}

    for sp in plan["stations"]:
        station = sp["station"]
        for a in sp["assignments"]:
            oid = a["officer_id"]
            officer_map.setdefault(oid, {
                "name": a["officer_name"],
                "email": a["officer_email"],
                "station": station,
                "assignments": [],
            })["assignments"].append(a)

            if a.get("tow_truck_id"):
                tid = a["tow_truck_id"]
                truck_map.setdefault(tid, {
                    "driver": a["tow_truck_driver"],
                    "email": "",  # not in current schema; use lookup if available
                    "station": station,
                    "assignments": [],
                })["assignments"].append(a)

    for oid, data in officer_map.items():
        if not data["email"]:
            data["email"] = f"{oid}@example.com"
        subject, body = _format_officer_email(oid, data["name"], data["station"], data["assignments"], plan["date"])
        result = send_email(data["email"], subject, body, dry_run=dry_run)
        results.append({"recipient_type": "officer", "recipient_id": oid, **result})

    for tid, data in truck_map.items():
        email = data["email"] or f"{tid}@example.com"
        subject, body = _format_truck_email(tid, data["driver"], data["station"], data["assignments"], plan["date"])
        result = send_email(email, subject, body, dry_run=dry_run)
        results.append({"recipient_type": "tow_truck", "recipient_id": tid, **result})

    record_dispatch()
    return results


def dispatch_full_workflow(plan: dict, dry_run: bool = True) -> dict:
    """Send to head officer first; in real use approval happens before officer dispatch."""
    head_result = dispatch_head_officer(plan, dry_run=dry_run)
    return {
        "head_officer": head_result,
        "note": "Officer/truck dispatch requires head-officer approval via approval_queue.approve_plan()",
    }
