"""
Generate synthetic officer profiles for demo purposes.
"""

from __future__ import annotations

import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "synthetic_officers.csv"

FIRST_NAMES = ["Ramesh", "Suresh", "Mahesh", "Ganesh", "Venkatesh", "Anil", "Sunil", "Nitin", "Prakash", "Arun"]
LAST_NAMES = ["Kumar", "Singh", "Reddy", "Naidu", "Rao", "Patil", "Sharma", "Gupta", "Desai", "Iyer"]


def generate_officers(stations: list[str] | None = None, officers_per_station: int = 5) -> pd.DataFrame:
    """Generate synthetic officers per station."""
    if stations is None:
        # Load from current scored hotspots
        scored = pd.read_parquet(PROJECT_ROOT / "data" / "outputs" / "scored_hotspots.parquet")
        stations = sorted(scored["assigned_station"].unique())

    rows = []
    for station in stations:
        for i in range(officers_per_station):
            name = f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[i % len(LAST_NAMES)]}"
            officer_id = f"OFF_{station.replace(' ', '_').upper()}_{i+1:02d}"
            rows.append({
                "officer_id": officer_id,
                "name": name,
                "assigned_station": station,
                "email": f"{officer_id.lower()}@btp-demo.example",
                "phone": f"+91-9{8000000000 + hash(officer_id) % 999999999}",
                "shift": "day" if i < 3 else "night",
                "rank": "ASI" if i < 3 else "HC",
            })

    df = pd.DataFrame(rows)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"[demo] Generated {len(df)} synthetic officers: {OUTPUT_PATH}")
    return df


if __name__ == "__main__":
    generate_officers()
