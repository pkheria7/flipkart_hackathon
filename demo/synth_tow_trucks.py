"""
Generate synthetic tow truck profiles for demo purposes.
"""

from __future__ import annotations

import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "synthetic_tow_trucks.csv"

DRIVER_NAMES = ["Kiran", "Manjunath", "Ravi", "Hari", "Babu", "Shankar", "Mohan", "Krishna", "Lakshmi", "Padma"]


def generate_tow_trucks(stations: list[str] | None = None, trucks_per_station: int = 2) -> pd.DataFrame:
    """Generate synthetic tow trucks per station."""
    if stations is None:
        scored = pd.read_parquet(PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet")
        stations = sorted(scored["assigned_station"].unique())

    rows = []
    for station in stations:
        for i in range(trucks_per_station):
            truck_id = f"TOW_{station.replace(' ', '_').upper()}_{i+1:02d}"
            rows.append({
                "truck_id": truck_id,
                "assigned_station": station,
                "driver_name": DRIVER_NAMES[i % len(DRIVER_NAMES)],
                "email": f"{truck_id.lower()}@btp-demo.example",
                "phone": f"+91-7{7000000000 + hash(truck_id) % 999999999}",
                "capacity": 2 if i == 0 else 4,
            })

    df = pd.DataFrame(rows)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"[demo] Generated {len(df)} synthetic tow trucks: {OUTPUT_PATH}")
    return df


if __name__ == "__main__":
    generate_tow_trucks()
