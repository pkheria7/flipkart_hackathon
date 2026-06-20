"""
Stage P1 — Data Cleaning

Purpose:
    Load the raw Theme 1 violation CSV, parse nested JSON columns, normalize
    timestamps to Asia/Kolkata, resolve vehicle types, filter invalid GPS
    coordinates, and engineer basic temporal/location features.

Inputs:
    data/raw/theme1_dataset.csv

Outputs:
    data/processed/cleaned_violations.parquet

Key transformations:
    - Parse `violation_type` and `offence_code` arrays with ast.literal_eval.
    - Localize `created_datetime` to UTC then convert to Asia/Kolkata.
    - Derive `veh` from updated_vehicle_type with fallback to vehicle_type.
    - Keep rows inside Bengaluru bounding box (lat 12.8-13.2, lng 77.4-77.8).
    - Add hour, day_of_week, week_number, is_peak_hour, time_period,
      junction_flag features.

Owner:
    Phase 0 pair-programmed by both developers.
"""

# TODO: implement P1 cleaning logic
