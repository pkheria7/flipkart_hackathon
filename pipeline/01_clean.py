"""
Stage P1 — Data Cleaning

Purpose:
    Load the raw Theme 1 violation CSV, parse nested JSON columns, normalize
    timestamps to Asia/Kolkata, resolve vehicle types, filter invalid GPS
    coordinates, and engineer basic temporal/location features.

Inputs:
    jan to may police violation_anonymized791b166.csv (project root)

Outputs:
    data/processed/cleaned_violations.parquet
    data/processed/cleaned_violations.csv
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_CSV_PATH = PROJECT_ROOT / "jan to may police violation_anonymized791b166.csv"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_PARQUET = PROCESSED_DIR / "cleaned_violations.parquet"
OUTPUT_CSV = PROCESSED_DIR / "cleaned_violations.csv"

BBOX = {
    "lat_min": 12.8,
    "lat_max": 13.2,
    "lng_min": 77.4,
    "lng_max": 77.8,
}

PEAK_HOURS = {8, 9, 17, 18, 19}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def snake_case(name: str) -> str:
    """Convert a column name to snake_case."""
    name = str(name).strip()
    name = re.sub(r"[^0-9a-zA-Z_]+", "_", name)
    name = re.sub(r"_+", "_", name)
    name = name.strip("_")
    return name.lower()


def parse_json_list(value) -> list:
    """Safely parse a string that represents a JSON/Python list."""
    if value is None or pd.isna(value):
        return []
    if isinstance(value, list):
        return value
    value = str(value).strip()
    if value in {"", "NULL", "null", "None", "nan"}:
        return []
    try:
        parsed = ast.literal_eval(value)
        return list(parsed) if isinstance(parsed, (list, tuple)) else [parsed]
    except Exception:
        try:
            parsed = json.loads(value)
            return list(parsed) if isinstance(parsed, list) else [parsed]
        except Exception:
            return [value]


def clean_text_series(series: pd.Series) -> pd.Series:
    """Trim, uppercase, and normalize common NULL-like strings."""
    s = series.astype(str).str.strip()
    s = s.replace({
        "NULL": np.nan,
        "null": np.nan,
        "None": np.nan,
        "none": np.nan,
        "NaN": np.nan,
        "nan": np.nan,
        "": np.nan,
    })
    return s.str.upper().where(s.notna())


def classify_time_period(hour: int) -> str:
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    if 21 <= hour < 24:
        return "night"
    return "late_night"


def detect_junction_flag(violation_list: list) -> bool:
    """True if violation_type list contains junction/crossing keywords."""
    if not violation_list:
        return False
    text = " ".join(str(v).upper() for v in violation_list)
    return any(k in text for k in [
        "PARKING NEAR ROAD CROSSING",
        "NEAR ROAD CROSSING",
        "JUNCTION",
        "CROSSING",
    ])


def build_quality_summary(df_raw: pd.DataFrame, df_clean: pd.DataFrame) -> dict:
    raw_rows = len(df_raw)
    cleaned_rows = len(df_clean)
    dropped_rows = raw_rows - cleaned_rows

    null_pct = (df_clean.isnull().mean() * 100).round(2).to_dict()

    top_vehicles = df_clean["vehicle_type_final"].value_counts().head(10).to_dict()
    top_stations = df_clean["police_station_clean"].value_counts().head(10).to_dict()
    top_violation_combinations = df_clean["violation_type_clean"].value_counts().head(10).to_dict()
    top_violation_types = df_clean["violation_type_list"].explode().value_counts().head(10).to_dict()

    # Timestamp usability checks
    action_usable = df_clean["action_taken_timestamp"].notna().sum()
    closed_usable = df_clean["closed_datetime"].notna().sum()
    validation_usable = df_clean["validation_status"].notna().sum()

    return {
        "raw_rows": raw_rows,
        "cleaned_rows": cleaned_rows,
        "dropped_rows": dropped_rows,
        "drop_rate_pct": round(dropped_rows / raw_rows * 100, 2) if raw_rows else 0.0,
        "null_percentages": null_pct,
        "top_vehicle_types": top_vehicles,
        "top_police_stations": top_stations,
        "top_violation_combinations": top_violation_combinations,
        "top_violation_types": top_violation_types,
        "timestamp_usability": {
            "action_taken_timestamp_non_null": int(action_usable),
            "closed_datetime_non_null": int(closed_usable),
            "validation_status_non_null": int(validation_usable),
            "note": "action_taken_timestamp/closed_datetime are mostly NULL in this anonymized dataset; do not rely on them for classification.",
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def clean_data() -> tuple[pd.DataFrame, dict]:
    print(f"[P1] Loading raw CSV: {RAW_CSV_PATH}")
    df = pd.read_csv(RAW_CSV_PATH, low_memory=False)

    # Rename to snake_case
    df.columns = [snake_case(c) for c in df.columns]
    print(f"[P1] Raw rows: {len(df):,}")

    # Parse list columns
    df["violation_type_list"] = df["violation_type"].apply(parse_json_list)
    df["offence_code_list"] = df["offence_code"].apply(parse_json_list)

    # Keep string representations for CSV export and summary
    df["violation_type_clean"] = df["violation_type_list"].apply(lambda x: json.dumps(x) if x else "[]")
    df["offence_code_clean"] = df["offence_code_list"].apply(lambda x: json.dumps(x) if x else "[]")

    # Coordinate cleaning and bbox filter
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    before_bbox = len(df)
    df = df[
        (df["latitude"].between(BBOX["lat_min"], BBOX["lat_max"]))
        & (df["longitude"].between(BBOX["lng_min"], BBOX["lng_max"]))
        & df["latitude"].notna()
        & df["longitude"].notna()
    ].copy()
    dropped_bbox = before_bbox - len(df)
    print(f"[P1] Dropped {dropped_bbox:,} rows outside Bengaluru bbox")

    # Timestamp parsing
    df["created_datetime"] = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
    df["created_datetime_ist"] = df["created_datetime"].dt.tz_convert("Asia/Kolkata")

    df["action_taken_timestamp"] = pd.to_datetime(df["action_taken_timestamp"], errors="coerce", utc=True)
    df["closed_datetime"] = pd.to_datetime(df["closed_datetime"], errors="coerce", utc=True)
    df["modified_datetime"] = pd.to_datetime(df["modified_datetime"], errors="coerce", utc=True)
    df["validation_timestamp"] = pd.to_datetime(df["validation_timestamp"], errors="coerce", utc=True)

    # Drop rows with unparseable created_datetime
    before_time = len(df)
    df = df[df["created_datetime_ist"].notna()].copy()
    dropped_time = before_time - len(df)
    print(f"[P1] Dropped {dropped_time:,} rows with unparseable created_datetime")

    # Temporal features
    df["date_ist"] = df["created_datetime_ist"].dt.date
    df["hour"] = df["created_datetime_ist"].dt.hour
    df["day_of_week"] = df["created_datetime_ist"].dt.dayofweek  # Monday=0
    df["day_name"] = df["created_datetime_ist"].dt.day_name()
    df["week_number"] = df["created_datetime_ist"].dt.isocalendar().week.astype(int)
    df["month"] = df["created_datetime_ist"].dt.month
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["is_peak_hour"] = df["hour"].isin(PEAK_HOURS).astype(int)
    df["time_period"] = df["hour"].apply(classify_time_period)

    # Vehicle type resolution
    df["updated_vehicle_type"] = clean_text_series(df.get("updated_vehicle_type", pd.Series(np.nan, index=df.index)))
    df["vehicle_type"] = clean_text_series(df.get("vehicle_type", pd.Series(np.nan, index=df.index)))
    df["vehicle_type_final"] = df["updated_vehicle_type"].fillna(df["vehicle_type"]).fillna("UNKNOWN")

    # Clean text fields
    df["police_station_clean"] = clean_text_series(df.get("police_station", pd.Series(np.nan, index=df.index)))
    df["location_clean"] = df["location"].astype(str).str.strip().replace({"NULL": np.nan, "None": np.nan, "nan": np.nan, "": np.nan})
    df["junction_name"] = df["junction_name"].astype(str).str.strip().replace({"NULL": np.nan, "None": np.nan, "nan": np.nan, "": np.nan})

    # Junction features
    df["junction_flag"] = df["violation_type_list"].apply(detect_junction_flag).astype(int)
    df["has_junction_name"] = (
        df["junction_name"].notna()
        & (df["junction_name"].str.upper() != "NO JUNCTION")
    ).astype(int)

    # ID column sanity
    df["violation_id"] = df["id"].astype(str)

    # Final column ordering (useful subset)
    final_cols = [
        "violation_id",
        "id",
        "latitude",
        "longitude",
        "location",
        "location_clean",
        "vehicle_number",
        "updated_vehicle_number",
        "vehicle_type",
        "updated_vehicle_type",
        "vehicle_type_final",
        "description",
        "violation_type",
        "violation_type_list",
        "violation_type_clean",
        "offence_code",
        "offence_code_list",
        "offence_code_clean",
        "created_datetime",
        "created_datetime_ist",
        "date_ist",
        "hour",
        "day_of_week",
        "day_name",
        "week_number",
        "month",
        "is_weekend",
        "is_peak_hour",
        "time_period",
        "police_station",
        "police_station_clean",
        "junction_name",
        "junction_flag",
        "has_junction_name",
        "action_taken_timestamp",
        "closed_datetime",
        "modified_datetime",
        "validation_status",
        "validation_timestamp",
        "device_id",
        "created_by_id",
        "center_code",
        "data_sent_to_scita",
        "data_sent_to_scita_timestamp",
    ]

    present_cols = [c for c in final_cols if c in df.columns]
    df = df[present_cols].copy()

    # Sort by time
    df = df.sort_values("created_datetime_ist").reset_index(drop=True)

    # Save
    df.to_parquet(OUTPUT_PARQUET, index=False)

    # CSV-safe version: keep list columns as JSON strings already done above
    df.to_csv(OUTPUT_CSV, index=False)

    summary = build_quality_summary(pd.read_csv(RAW_CSV_PATH, low_memory=False), df)
    summary["dropped_bbox"] = int(dropped_bbox)
    summary["dropped_time"] = int(dropped_time)

    print(f"[P1] Saved cleaned data: {OUTPUT_PARQUET} ({len(df):,} rows)")
    print(f"[P1] Saved CSV: {OUTPUT_CSV}")

    return df, summary


if __name__ == "__main__":
    _, summary = clean_data()
    print("\n[P1] Data quality summary:")
    print(json.dumps(summary, indent=2, default=str))
