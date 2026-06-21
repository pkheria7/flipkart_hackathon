"""
Generate synthetic feedback events for the 2-week demo.

This module creates officer and citizen feedback events for Week 1 patrols.
All events are tagged with `source = 'synthetic_demo'`.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys_path_set = False
if str(PROJECT_ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(PROJECT_ROOT))
    sys_path_set = True

from agents.feedback_ingestor import ingest_officer_feedback, ingest_citizen_feedback
from agents.feedback_ingestor import clear_synthetic_feedback

np.random.seed(42)
random.seed(42)

OFFICER_REASONS = ["no_parking_space", "loading", "broke_down", "ignored_sign", "other"]
CITIZEN_REASONS = ["no_parking_space", "customer_waiting", "loading", "other"]


def generate_week_1_feedback(
    scored: pd.DataFrame,
    officers: pd.DataFrame,
    max_feedback_per_station: int = 10,
) -> pd.DataFrame:
    """
    Generate synthetic feedback for high-ROI patrols in Week 1.
    Returns a DataFrame of generated events for reporting.
    """
    clear_synthetic_feedback()

    events = []
    demo_start = datetime(2026, 6, 15, tzinfo=timezone.utc)

    for station, group in scored.groupby("assigned_station"):
        station_officers = officers[officers["assigned_station"] == station]
        if station_officers.empty:
            continue

        top = group.nlargest(max_feedback_per_station, "roi_score")

        for _, row in top.iterrows():
            officer = station_officers.sample(1).iloc[0]

            # Outcome probabilities depend on classification
            if row["classification"] == "STRUCTURAL":
                outcome = random.choices(
                    ["resolved", "recurred", "no_violation"],
                    weights=[50, 40, 10]
                )[0]
            elif row["classification"] == "SEASONAL":
                outcome = random.choices(
                    ["resolved", "recurred", "no_violation"],
                    weights=[60, 25, 15]
                )[0]
            else:  # RESPONSIVE
                outcome = random.choices(
                    ["resolved", "recurred", "no_violation"],
                    weights=[75, 20, 5]
                )[0]

            action = random.choice(["towed", "warned", "could_not_enforce"])
            reason_code = random.choice(OFFICER_REASONS)

            # Timestamp during Week 1
            day_offset = random.randint(0, 6)
            hour_offset = random.randint(8, 20)
            ts = demo_start + timedelta(days=day_offset, hours=hour_offset)

            # Officer feedback
            ingest_officer_feedback(
                cluster_id=row["cluster_id"],
                officer_id=officer["officer_id"],
                action=action,
                outcome=outcome,
                reason_code=reason_code,
                reason_text=f"Synthetic officer feedback for demo",
                source="synthetic_demo",
            )

            events.append({
                "cluster_id": row["cluster_id"],
                "officer_id": officer["officer_id"],
                "action": action,
                "outcome": outcome,
                "reason_code": reason_code,
                "timestamp": ts.isoformat(),
                "source": "synthetic_demo",
                "feedback_type": "officer",
            })

            # Citizen feedback for some cases
            if random.random() < 0.4:
                citizen_reason = random.choice(CITIZEN_REASONS)
                ingest_citizen_feedback(
                    cluster_id=row["cluster_id"],
                    reason_code=citizen_reason,
                    reason_text="Synthetic citizen feedback for demo",
                    source="synthetic_demo",
                )
                events.append({
                    "cluster_id": row["cluster_id"],
                    "officer_id": None,
                    "action": None,
                    "outcome": None,
                    "reason_code": citizen_reason,
                    "timestamp": (ts + timedelta(minutes=30)).isoformat(),
                    "source": "synthetic_demo",
                    "feedback_type": "citizen",
                })

    print(f"[demo] Generated {len(events)} synthetic feedback events")
    return pd.DataFrame(events)


if __name__ == "__main__":
    scored = pd.read_parquet(PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet")
    officers = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "synthetic_officers.parquet") \
        if (PROJECT_ROOT / "data" / "processed" / "synthetic_officers.parquet").exists() \
        else pd.read_csv(PROJECT_ROOT / "data" / "processed" / "synthetic_officers.csv")
    generate_week_1_feedback(scored, officers)
