"""
Stage P2 — Violation Clustering

Purpose:
    Group cleaned violations into spatial hotspots using H3 hexagonal indexing and
    DBSCAN on haversine distances, then aggregate cluster-level metrics.

Inputs:
    data/processed/cleaned_violations.parquet

Outputs:
    data/processed/clustered_violations.parquet + .csv
    data/processed/cluster_summary.parquet + .csv
    data/processed/cluster_handoff_for_prakhar.parquet + .csv
    reports/P1_P2_DATA_QUALITY_SUMMARY.md
    reports/cluster_sanity_map.html
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN

import folium

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORTS_DIR = PROJECT_ROOT / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

INPUT_PARQUET = PROCESSED_DIR / "cleaned_violations.parquet"

OUTPUT_CLUSTERED_PARQUET = PROCESSED_DIR / "clustered_violations.parquet"
OUTPUT_CLUSTERED_CSV = PROCESSED_DIR / "clustered_violations.csv"
OUTPUT_SUMMARY_PARQUET = PROCESSED_DIR / "cluster_summary.parquet"
OUTPUT_SUMMARY_CSV = PROCESSED_DIR / "cluster_summary.csv"
OUTPUT_HANDOFF_PARQUET = PROCESSED_DIR / "cluster_handoff_for_prakhar.parquet"
OUTPUT_HANDOFF_CSV = PROCESSED_DIR / "cluster_handoff_for_prakhar.csv"

REPORT_SUMMARY_MD = REPORTS_DIR / "P1_P2_DATA_QUALITY_SUMMARY.md"
REPORT_HANDOVER_MD = REPORTS_DIR / "P1_P2_HANDOVER_REPORT.md"
MAP_HTML = REPORTS_DIR / "cluster_sanity_map.html"

EARTH_RADIUS_M = 6_371_000
# Tuned: 150m chained whole neighborhoods into mega-clusters.
# 50m and 30m still produced a few mega-clusters in ultra-dense commercial areas.
# 20m gives tighter, block-level hotspots while keeping noise reasonable.
EPS_METERS = 20.0
MIN_SAMPLES = 15
TOP_N_MAP_CLUSTERS = 50

# Oversized-cluster post-processing
OVERSIZED_VIOLATION_THRESHOLD = 10_000
OVERSIZED_H3_THRESHOLD = 8
SUBCLUSTER_EPS_METERS = 10.0
SUBCLUSTER_MIN_SAMPLES = 10


# ---------------------------------------------------------------------------
# H3 helpers
# ---------------------------------------------------------------------------
def get_h3_res9(lat: float, lng: float) -> str | None:
    """Return H3 resolution-9 cell, trying H3 v4 then v3 APIs."""
    try:
        import h3
    except ImportError:
        return None

    if pd.isna(lat) or pd.isna(lng):
        return None

    # H3 v4 API
    if hasattr(h3, "latlng_to_cell"):
        try:
            return h3.latlng_to_cell(float(lat), float(lng), 9)
        except Exception:
            pass

    # H3 v3 API
    if hasattr(h3, "geo_to_h3"):
        try:
            return h3.geo_to_h3(float(lat), float(lng), 9)
        except Exception:
            pass

    return None


# ---------------------------------------------------------------------------
# Cluster summary helpers
# ---------------------------------------------------------------------------
def mode_series(series: pd.Series) -> str:
    """Return the most common non-null value in a series."""
    vals = series.dropna()
    if vals.empty:
        return "UNKNOWN"
    if vals.dtype == object:
        vals = vals.astype(str).str.strip()
        vals = vals[vals != ""]
    if vals.empty:
        return "UNKNOWN"
    return vals.value_counts().idxmax()


def build_vehicle_mix(group: pd.DataFrame) -> tuple[str, str]:
    counts = group["vehicle_type_final"].dropna().value_counts().to_dict()
    if not counts:
        return "UNKNOWN:0", "{}"
    parts = [f"{k}:{v}" for k, v in counts.items()]
    return ",".join(parts), json.dumps(counts)


def compute_cluster_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate one row per real DBSCAN cluster."""
    real_clusters = df[df["is_clustered"] == 1].copy()
    if real_clusters.empty:
        return pd.DataFrame()

    summaries = []
    for cluster_id, g in real_clusters.groupby("cluster_id"):
        centroid_lat = g["latitude"].mean()
        centroid_lng = g["longitude"].mean()
        violation_count = len(g)

        unique_vehicles = g["vehicle_type_final"].dropna().nunique()
        dominant_vehicle = mode_series(g["vehicle_type_final"])
        vehicle_mix, vehicle_mix_json = build_vehicle_mix(g)

        police_station_mode = mode_series(g["police_station_clean"])
        location_mode = mode_series(g["location_clean"])
        junction_name_mode = mode_series(g["junction_name"])

        junction_flag_rate = g["junction_flag"].mean()
        has_junction_name_rate = g["has_junction_name"].mean()

        first_seen = g["created_datetime_ist"].min()
        last_seen = g["created_datetime_ist"].max()
        active_days = g["date_ist"].nunique()
        active_weeks = g["week_number"].nunique()

        peak_hour_basic = int(g["hour"].mode().iloc[0]) if not g["hour"].mode().empty else -1
        peak_day_basic = g["day_name"].mode().iloc[0] if not g["day_name"].mode().empty else "UNKNOWN"
        h3_cells_count = g["h3_res9"].nunique()

        # Simple quality heuristic
        if violation_count > OVERSIZED_VIOLATION_THRESHOLD:
            cluster_quality = "needs_review"
        elif violation_count >= 100 and h3_cells_count <= 10:
            cluster_quality = "good"
        elif violation_count >= MIN_SAMPLES and h3_cells_count <= 20:
            cluster_quality = "medium"
        else:
            cluster_quality = "needs_review"

        needs_manual_review = 1 if (
            violation_count < MIN_SAMPLES * 2
            or violation_count > OVERSIZED_VIOLATION_THRESHOLD
            or h3_cells_count > 20
            or active_weeks > 20
        ) else 0

        summaries.append({
            "cluster_id": cluster_id,
            "centroid_lat": centroid_lat,
            "centroid_lng": centroid_lng,
            "violation_count": violation_count,
            "unique_vehicle_types": unique_vehicles,
            "dominant_vehicle_type": dominant_vehicle,
            "vehicle_mix": vehicle_mix,
            "vehicle_mix_json": vehicle_mix_json,
            "police_station_mode": police_station_mode,
            "location_mode": location_mode,
            "junction_name_mode": junction_name_mode,
            "junction_flag_rate": round(junction_flag_rate, 4),
            "has_junction_name_rate": round(has_junction_name_rate, 4),
            "first_seen_ist": first_seen,
            "last_seen_ist": last_seen,
            "active_days": active_days,
            "active_weeks": active_weeks,
            "peak_hour_basic": peak_hour_basic,
            "peak_day_basic": peak_day_basic,
            "h3_cells_count": h3_cells_count,
            "cluster_quality": cluster_quality,
            "needs_manual_review": needs_manual_review,
        })

    summary_df = pd.DataFrame(summaries)
    summary_df = summary_df.sort_values("violation_count", ascending=False).reset_index(drop=True)
    return summary_df


# ---------------------------------------------------------------------------
# Oversized cluster splitting
# ---------------------------------------------------------------------------
def split_oversized_clusters(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """
    Identify oversized clusters and re-run DBSCAN with tighter parameters inside
    each one. Replace the parent cluster_id with subcluster IDs (C_0_0, C_0_1, ...).

    Returns the updated DataFrame and a list of split records for reporting.
    """
    clustered = df[df["is_clustered"] == 1].copy()
    if clustered.empty:
        return df, []

    cluster_stats = clustered.groupby("cluster_id").agg(
        violation_count=("cluster_id", "size"),
        h3_cells_count=("h3_res9", "nunique"),
    )

    oversized_mask = (
        (cluster_stats["violation_count"] > OVERSIZED_VIOLATION_THRESHOLD)
        | (cluster_stats["h3_cells_count"] > OVERSIZED_H3_THRESHOLD)
    )
    oversized_ids = cluster_stats[oversized_mask].index.tolist()

    if not oversized_ids:
        return df, []

    print(f"[P2] Found {len(oversized_ids)} oversized cluster(s) to split.")

    split_records: list[dict] = []
    next_global_label = int(df["dbscan_label"].max()) + 1

    for old_id in oversized_ids:
        old_count = int(cluster_stats.loc[old_id, "violation_count"])
        old_h3_count = int(cluster_stats.loc[old_id, "h3_cells_count"])
        mask = df["cluster_id"] == old_id
        sub_df = df.loc[mask].copy()

        print(f"[P2] Splitting {old_id}: {len(sub_df):,} violations, {old_h3_count} H3 cells...")

        coords = np.radians(sub_df[["latitude", "longitude"]].values)
        eps_radians = SUBCLUSTER_EPS_METERS / EARTH_RADIUS_M

        db = DBSCAN(
            eps=eps_radians,
            min_samples=SUBCLUSTER_MIN_SAMPLES,
            metric="haversine",
            algorithm="ball_tree",
        )
        sub_labels = db.fit_predict(coords)

        unique_labels = set(sub_labels)
        n_subclusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_noise = int((sub_labels == -1).sum())

        # Build new IDs and labels
        new_cluster_ids = []
        new_dbscan_labels = []
        subcluster_counts = Counter()
        for label in sub_labels:
            if label == -1:
                new_cluster_ids.append("NOISE")
                new_dbscan_labels.append(-1)
            else:
                new_id = f"{old_id}_{label}"
                new_cluster_ids.append(new_id)
                new_dbscan_labels.append(next_global_label + label)
                subcluster_counts[new_id] += 1

        # Ensure next batch of labels does not collide
        if n_subclusters > 0:
            next_global_label += n_subclusters

        df.loc[mask, "cluster_id"] = new_cluster_ids
        df.loc[mask, "dbscan_label"] = new_dbscan_labels
        df.loc[mask, "is_clustered"] = (sub_labels >= 0).astype(int)

        largest_sub_count = max(subcluster_counts.values()) if subcluster_counts else 0
        print(
            f"[P2]   -> {old_id} split into {n_subclusters} subcluster(s), "
            f"largest={largest_sub_count:,}, noise={n_noise:,}"
        )

        split_records.append({
            "old_cluster_id": old_id,
            "old_violation_count": old_count,
            "old_h3_cells_count": old_h3_count,
            "n_subclusters": n_subclusters,
            "largest_subcluster_count": largest_sub_count,
            "noise_rows_created": n_noise,
            "subcluster_eps_m": SUBCLUSTER_EPS_METERS,
            "subcluster_min_samples": SUBCLUSTER_MIN_SAMPLES,
        })

    return df, split_records


# ---------------------------------------------------------------------------
# Map
# ---------------------------------------------------------------------------
def build_sanity_map(cluster_summary: pd.DataFrame, df: pd.DataFrame) -> None:
    """Create a Folium map of top clusters."""
    top_clusters = cluster_summary.head(TOP_N_MAP_CLUSTERS).copy()
    if top_clusters.empty:
        print("[P2] No clusters to map.")
        return

    center_lat = top_clusters["centroid_lat"].mean()
    center_lng = top_clusters["centroid_lng"].mean()

    m = folium.Map(location=[center_lat, center_lng], zoom_start=12, tiles="cartodbpositron")

    colors = ["red", "blue", "green", "purple", "orange", "darkred", "darkblue", "cadetblue"]

    for idx, row in top_clusters.iterrows():
        color = colors[idx % len(colors)]
        popup_html = (
            f"<b>Cluster {row['cluster_id']}</b><br>"
            f"Count: {row['violation_count']}<br>"
            f"Dominant vehicle: {row['dominant_vehicle_type']}<br>"
            f"Police station: {row['police_station_mode']}<br>"
            f"Peak hour: {row['peak_hour_basic']}<br>"
            f"Quality: {row['cluster_quality']}"
        )
        folium.CircleMarker(
            location=[row["centroid_lat"], row["centroid_lng"]],
            radius=5 + min(15, int(np.sqrt(row["violation_count"]))),
            color=color,
            fill=True,
            fill_opacity=0.7,
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=f"{row['cluster_id']}: {row['violation_count']} violations",
        ).add_to(m)

    m.save(MAP_HTML)
    print(f"[P2] Saved sanity map: {MAP_HTML}")


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
def format_split_summary(split_records: list[dict]) -> list[str]:
    """Return markdown lines for the oversized cluster split summary section."""
    if not split_records:
        return [
            "## Oversized Cluster Split Summary",
            "",
            "No clusters required splitting.",
            "",
        ]

    lines = [
        "## Oversized Cluster Split Summary",
        "",
        "Oversized clusters were re-clustered with tighter DBSCAN parameters to produce "
        "block/intersection-level subclusters.",
        "",
        "| old_cluster_id | old_count | old_h3_cells | subclusters | largest_subcluster | new_noise | eps | min_samples |",
        "|----------------|-----------|--------------|-------------|--------------------|-----------|-----|-------------|",
    ]
    for r in split_records:
        lines.append(
            f"| {r['old_cluster_id']} | {r['old_violation_count']:,} | "
            f"{r['old_h3_cells_count']} | {r['n_subclusters']} | "
            f"{r['largest_subcluster_count']:,} | {r['noise_rows_created']:,} | "
            f"{r['subcluster_eps_m']}m | {r['subcluster_min_samples']} |"
        )

    total_old = sum(r["old_violation_count"] for r in split_records)
    total_subclusters = sum(r["n_subclusters"] for r in split_records)
    total_noise = sum(r["noise_rows_created"] for r in split_records)
    lines.extend([
        "",
        f"- Total violations re-clustered: {total_old:,}",
        f"- Total subclusters created: {total_subclusters}",
        f"- Total new noise rows from splits: {total_noise:,}",
        f"- Final subclustering parameters: eps={SUBCLUSTER_EPS_METERS}m, "
        f"min_samples={SUBCLUSTER_MIN_SAMPLES}, metric=haversine.",
        "",
    ])
    return lines


def write_data_quality_summary(cleaned_rows: int, clustered_df: pd.DataFrame,
                               summary_df: pd.DataFrame, split_records: list[dict] | None = None,
                               p1_summary: dict | None = None) -> None:
    noise_rows = int((clustered_df["is_clustered"] == 0).sum())
    cluster_rows = int((clustered_df["is_clustered"] == 1).sum())
    n_clusters = summary_df["cluster_id"].nunique() if not summary_df.empty else 0

    quality_counts = summary_df["cluster_quality"].value_counts().to_dict() if not summary_df.empty else {}
    review_count = int(summary_df["needs_manual_review"].sum()) if not summary_df.empty else 0

    lines = [
        "# P1 + P2 Data Quality Summary",
        "",
    ]

    # P1 details
    if p1_summary:
        lines.append("## Cleaning (P1)")
        lines.append(f"- Raw rows: {p1_summary.get('raw_rows', 'N/A'):,}")
        lines.append(f"- Cleaned rows: {p1_summary.get('cleaned_rows', 'N/A'):,}")
        lines.append(f"- Dropped rows: {p1_summary.get('dropped_rows', 'N/A'):,}")
        lines.append(f"- Dropped outside bbox: {p1_summary.get('dropped_bbox', 'N/A'):,}")
        lines.append(f"- Dropped unparseable timestamp: {p1_summary.get('dropped_time', 'N/A'):,}")
        lines.append("")
        lines.append("### Top vehicle types")
        for k, v in list(p1_summary.get("top_vehicle_types", {}).items())[:10]:
            lines.append(f"- {k}: {v}")
        lines.append("")
        lines.append("### Top police stations")
        for k, v in list(p1_summary.get("top_police_stations", {}).items())[:10]:
            lines.append(f"- {k}: {v}")
        lines.append("")
        lines.append("### Top violation type combinations")
        for k, v in list(p1_summary.get("top_violation_combinations", {}).items())[:10]:
            lines.append(f"- {k}: {v}")
        lines.append("")
        lines.append("### Top individual violation types")
        for k, v in list(p1_summary.get("top_violation_types", {}).items())[:10]:
            lines.append(f"- {k}: {v}")
        lines.append("")
        ts = p1_summary.get("timestamp_usability", {})
        lines.append("### Timestamp usability")
        lines.append(f"- action_taken_timestamp non-null: {ts.get('action_taken_timestamp_non_null', 'N/A'):,}")
        lines.append(f"- closed_datetime non-null: {ts.get('closed_datetime_non_null', 'N/A'):,}")
        lines.append(f"- validation_status non-null: {ts.get('validation_status_non_null', 'N/A'):,}")
        lines.append(f"- Note: {ts.get('note', '')}")
        lines.append("")

    lines.extend([
        "## Clustering (P2)",
        f"- Total clustered rows: {cluster_rows:,}",
        f"- Noise rows: {noise_rows:,}",
        f"- Number of real clusters: {n_clusters:,}",
        "",
        "## Cluster quality distribution",
    ])
    for q, c in quality_counts.items():
        lines.append(f"- {q}: {c}")
    lines.append(f"- Clusters flagged for manual review: {review_count}")
    lines.append("")

    # Oversized split summary
    lines.extend(format_split_summary(split_records or []))

    lines.append("## Notes")
    lines.append(
        f"- Global DBSCAN parameters: eps={EPS_METERS}m, min_samples={MIN_SAMPLES}, metric=haversine."
    )
    if split_records:
        lines.append(
            f"- Oversized clusters re-clustered with: eps={SUBCLUSTER_EPS_METERS}m, "
            f"min_samples={SUBCLUSTER_MIN_SAMPLES}, metric=haversine."
        )
    lines.append("- Noise points retain cluster_id='NOISE' so the row-level table is complete.")
    lines.append("- All timestamps are in Asia/Kolkata (IST).")

    REPORT_SUMMARY_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[P2] Saved data quality summary: {REPORT_SUMMARY_MD}")


def write_handover_report(raw_rows: int, cleaned_rows: int, dropped_rows: int,
                          clustered_df: pd.DataFrame, summary_df: pd.DataFrame,
                          split_records: list[dict] | None = None,
                          p1_summary: dict | None = None) -> None:
    noise_rows = int((clustered_df["is_clustered"] == 0).sum())
    cluster_rows = int((clustered_df["is_clustered"] == 1).sum())
    n_clusters = summary_df["cluster_id"].nunique() if not summary_df.empty else 0

    sizes = summary_df["violation_count"] if not summary_df.empty else pd.Series(dtype=int)
    avg_size = float(sizes.mean()) if not sizes.empty else 0.0
    median_size = float(sizes.median()) if not sizes.empty else 0.0
    largest = int(sizes.max()) if not sizes.empty else 0
    smallest = int(sizes.min()) if not sizes.empty else 0

    quality_counts = summary_df["cluster_quality"].value_counts().to_dict() if not summary_df.empty else {}

    lines = [
        "# P1 + P2 Handover Report",
        "",
        "## Pipeline run summary",
        f"- Raw rows: {raw_rows:,}",
        f"- Cleaned rows: {cleaned_rows:,}",
        f"- Dropped rows: {dropped_rows:,}",
        f"- Clustered rows: {cluster_rows:,}",
        f"- Noise rows: {noise_rows:,}",
        f"- Number of clusters: {n_clusters:,}",
        "",
        "## Cluster size statistics",
        f"- Average size: {avg_size:.1f}",
        f"- Median size: {median_size:.1f}",
        f"- Largest cluster: {largest:,} violations",
        f"- Smallest cluster: {smallest:,} violations",
        "",
        "## Cluster quality distribution",
    ]
    for q, c in quality_counts.items():
        lines.append(f"- {q}: {c}")
    lines.append("")

    # Oversized split summary
    lines.extend(format_split_summary(split_records or []))

    lines.append("## Top 20 clusters by violation_count")
    lines.append("")
    lines.append("| Rank | cluster_id | centroid_lat | centroid_lng | count | dominant_vehicle | police_station_mode | quality |")
    lines.append("|------|------------|--------------|--------------|-------|------------------|---------------------|---------|")
    for rank, (_, row) in enumerate(summary_df.head(20).iterrows(), start=1):
        lines.append(
            f"| {rank} | {row['cluster_id']} | {row['centroid_lat']:.6f} | "
            f"{row['centroid_lng']:.6f} | {row['violation_count']} | "
            f"{row['dominant_vehicle_type']} | {row['police_station_mode']} | {row['cluster_quality']} |"
        )
    lines.append("")

    lines.append("## Handover instructions for Prakhar")
    lines.append("")
    lines.append("### For M3 Peak Window and M4 Recurrence")
    lines.append("Use **row-level** file:")
    lines.append(f"- `{OUTPUT_HANDOFF_PARQUET}`")
    lines.append(f"- `{OUTPUT_HANDOFF_CSV}`")
    lines.append("")
    lines.append("Key columns already provided:")
    lines.append("`cluster_id`, `created_datetime_ist`, `date_ist`, `hour`, `day_of_week`, `day_name`, `week_number`, `month`, `vehicle_type_final`, `junction_flag`, `police_station_clean`, `h3_res9`")
    lines.append("")
    lines.append("### For M18 Jurisdiction Scoping and cluster-level merging")
    lines.append("Use **cluster-level** file:")
    lines.append(f"- `{OUTPUT_SUMMARY_PARQUET}`")
    lines.append(f"- `{OUTPUT_SUMMARY_CSV}`")
    lines.append("")
    lines.append("Key columns:")
    lines.append("`cluster_id`, `centroid_lat`, `centroid_lng`, `violation_count`, `police_station_mode`, `location_mode`, `vehicle_mix`, `junction_flag_rate`, `h3_cells_count`")
    lines.append("")
    lines.append("### Join rule")
    lines.append("Join all future outputs on `cluster_id`. Noise rows keep `cluster_id='NOISE'` and should be excluded from cluster-level analysis.")
    lines.append("")
    lines.append("## DBSCAN tuning note")
    lines.append(f"- Global parameters: eps={EPS_METERS}m, min_samples={MIN_SAMPLES}.")
    if split_records:
        lines.append(
            f"- Oversized clusters re-clustered with: eps={SUBCLUSTER_EPS_METERS}m, "
            f"min_samples={SUBCLUSTER_MIN_SAMPLES}."
        )
    lines.append("- Initial plan suggested 150m, but that merged entire neighborhoods into mega-clusters.")
    lines.append("- Tuning rationale: reduce eps until dense commercial areas resolve into block/intersection-level hotspots.")
    lines.append("- If downstream modules see too many tiny clusters or too much noise, tune these values and re-run `pipeline/run_phase1.py`.")

    REPORT_HANDOVER_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[P2] Saved handover report: {REPORT_HANDOVER_MD}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def cluster_data(raw_rows: int = None, cleaned_rows: int = None, dropped_rows: int = 0,
                 p1_summary: dict | None = None) -> dict:
    print(f"[P2] Loading cleaned data: {INPUT_PARQUET}")
    df = pd.read_parquet(INPUT_PARQUET)

    # H3 resolution 9
    print("[P2] Computing H3 res-9 cells...")
    df["h3_res9"] = df.apply(lambda r: get_h3_res9(r["latitude"], r["longitude"]), axis=1)

    # DBSCAN with haversine distance
    print(f"[P2] Running DBSCAN: eps={EPS_METERS}m, min_samples={MIN_SAMPLES}...")
    coords = np.radians(df[["latitude", "longitude"]].values)
    eps_radians = EPS_METERS / EARTH_RADIUS_M

    db = DBSCAN(eps=eps_radians, min_samples=MIN_SAMPLES, metric="haversine", algorithm="ball_tree")
    labels = db.fit_predict(coords)

    df["dbscan_label"] = labels
    df["is_clustered"] = (labels >= 0).astype(int)
    df["cluster_id"] = df["dbscan_label"].apply(lambda x: f"C_{x}" if x >= 0 else "NOISE")

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = int((labels == -1).sum())
    print(f"[P2] Global DBSCAN clusters found: {n_clusters:,}, Noise points: {n_noise:,}")

    # Oversized cluster post-processing
    df, split_records = split_oversized_clusters(df)
    n_noise_after = int((df["is_clustered"] == 0).sum())
    n_clusters_after = df[df["is_clustered"] == 1]["cluster_id"].nunique()
    print(
        f"[P2] After oversized split: clusters={n_clusters_after:,}, "
        f"noise={n_noise_after:,}"
    )

    # Save row-level clustered data
    df.to_parquet(OUTPUT_CLUSTERED_PARQUET, index=False)
    df.to_csv(OUTPUT_CLUSTERED_CSV, index=False)
    print(f"[P2] Saved clustered rows: {OUTPUT_CLUSTERED_PARQUET} ({len(df):,} rows)")

    # Cluster summary
    print("[P2] Building cluster summary...")
    summary_df = compute_cluster_summary(df)
    if not summary_df.empty:
        summary_df.to_parquet(OUTPUT_SUMMARY_PARQUET, index=False)
        summary_df.to_csv(OUTPUT_SUMMARY_CSV, index=False)
        print(f"[P2] Saved cluster summary: {OUTPUT_SUMMARY_PARQUET} ({len(summary_df):,} clusters)")
    else:
        print("[P2] WARNING: No clusters found.")

    # Handoff file
    handoff_cols = [
        "cluster_id",
        "latitude",
        "longitude",
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
        "vehicle_type_final",
        "violation_type_clean",
        "offence_code_clean",
        "junction_flag",
        "has_junction_name",
        "junction_name",
        "police_station_clean",
        "location_clean",
        "h3_res9",
        "dbscan_label",
        "is_clustered",
    ]
    handoff_cols = [c for c in handoff_cols if c in df.columns]
    handoff_df = df[handoff_cols].copy()
    handoff_df.to_parquet(OUTPUT_HANDOFF_PARQUET, index=False)
    handoff_df.to_csv(OUTPUT_HANDOFF_CSV, index=False)
    print(f"[P2] Saved handoff file: {OUTPUT_HANDOFF_PARQUET}")

    # Reports and map
    write_data_quality_summary(len(df), df, summary_df, split_records=split_records, p1_summary=p1_summary)
    write_handover_report(raw_rows or 0, cleaned_rows or len(df), dropped_rows, df, summary_df,
                          split_records=split_records, p1_summary=p1_summary)
    build_sanity_map(summary_df, df)

    return {
        "clustered_rows": len(df),
        "noise_rows": n_noise_after,
        "n_clusters": n_clusters_after,
        "cluster_summary_path": str(OUTPUT_SUMMARY_PARQUET),
        "cluster_handoff_path": str(OUTPUT_HANDOFF_PARQUET),
        "map_path": str(MAP_HTML),
        "split_records": split_records,
    }


if __name__ == "__main__":
    result = cluster_data()
    print("\n[P2] Clustering summary:")
    print(json.dumps(result, indent=2, default=str))
