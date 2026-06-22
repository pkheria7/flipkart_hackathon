# Timestamp UTC → IST Validation Report

**Date:** 2026-06-21  
**Pipeline run:** `20260621_155207`  
**Status:** VALIDATED — conversion already correct; explicit columns added

---

## 1. Audit finding: was previous logic correct?

**Yes — the existing pipeline was already correct.**

Before this audit the raw CSV timestamps were:
- Stored as strings with an explicit `+00` UTC offset, e.g. `'2023-11-20 00:28:46+00'`
- Parsed in `pipeline/01_clean.py` with `pd.to_datetime(..., utc=True)` — which correctly handles the `+00` suffix and treats any offset-naive strings as UTC
- Immediately converted to `Asia/Kolkata` with `dt.tz_convert("Asia/Kolkata")`
- All downstream temporal columns (`hour`, `date_ist`, `day_of_week`, `is_weekend`, `week_number`) were derived from `created_datetime_ist`, not the raw UTC string

**The `hour` column was IST hour, not UTC hour. No mislabelled violation times.**

---

## 2. What was added (minimal explicit hardening)

### `pipeline/01_clean.py` changes

| What | Before | After |
|------|--------|-------|
| Raw string preserved? | No — `created_datetime` immediately overwritten with parsed UTC | `created_datetime_raw` column added |
| UTC column name | `created_datetime` (ambiguous) | `created_datetime_utc` (explicit) |
| IST column | `created_datetime_ist` | unchanged |
| IST hour | `hour` derived from IST, but unnamed | `hour_ist` added; `hour` kept as backward-compat alias |
| IST weekday | `day_of_week` derived from IST | `weekday_ist` added; `day_of_week` kept as backward-compat alias |
| Anti-double-conv guard | None | Comment block: "single tz_convert — do not re-convert downstream" |

### Backward compatibility

`M3` (`03a_peak_windows.py`) and `M4` (`03b_classify_hotspots.py`) both use:
- `hour` — still present (alias for `hour_ist`)
- `is_weekend` — still present (derived from `weekday_ist`)
- `date_ist` — unchanged
- `day_name` — unchanged
- `week_number` — unchanged

Neither module required any code change.

---

## 3. Columns in `cleaned_violations.parquet` (confirmed)

| Column | Dtype | Meaning |
|--------|-------|---------|
| `created_datetime_raw` | `object` | Raw string from CSV, e.g. `2023-11-09 19:11:46+00` |
| `created_datetime_utc` | `datetime64[us, UTC]` | Parsed UTC timestamp |
| `created_datetime_ist` | `datetime64[us, Asia/Kolkata]` | IST timestamp (+05:30) |
| `date_ist` | `object` | IST date string, e.g. `2023-11-10` |
| `hour_ist` | `int32` | IST hour of violation (0–23) |
| `weekday_ist` | `int32` | IST weekday (Mon=0, Sun=6) |
| `hour` | `int32` | Alias for `hour_ist` |
| `day_of_week` | `int32` | Alias for `weekday_ist` |
| `is_weekend` | `int64` | 1 if Sat/Sun (IST), 0 otherwise |
| `is_peak_hour` | `int64` | 1 if hour_ist ∈ {8,9,17,18,19} |
| `time_period` | `object` | morning/afternoon/evening/night/late_night (IST) |

---

## 4. 5-row UTC → IST conversion sample

| created_datetime_raw | created_datetime_utc | created_datetime_ist | hour_ist | date_ist |
|----------------------|----------------------|----------------------|----------|----------|
| `2023-11-09 19:11:46+00` | `2023-11-09 19:11:46+00:00` | `2023-11-10 00:41:46+05:30` | 0 | 2023-11-10 |
| `2023-11-09 19:15:46+00` | `2023-11-09 19:15:46+00:00` | `2023-11-10 00:45:46+05:30` | 0 | 2023-11-10 |
| `2023-11-09 19:15:46+00` | `2023-11-09 19:15:46+00:00` | `2023-11-10 00:45:46+05:30` | 0 | 2023-11-10 |
| `2023-11-09 20:08:46+00` | `2023-11-09 20:08:46+00:00` | `2023-11-10 01:38:46+05:30` | 1 | 2023-11-10 |
| `2023-11-09 20:08:46+00` | `2023-11-09 20:08:46+00:00` | `2023-11-10 01:38:46+05:30` | 1 | 2023-11-10 |

**Offset verification:** `2023-11-09 19:11 UTC → 2023-11-10 00:41 IST` = +5h30m ✓  
**Date boundary check:** UTC date is `2023-11-09` but IST date is `2023-11-10` — correct because 19:11 UTC crosses midnight in IST.

Full audit sample saved to: `reports/TIMESTAMP_UTC_TO_IST_AUDIT_SAMPLE.csv`

---

## 5. Downstream modules verified

| Module | Columns used | IST-correct? |
|--------|-------------|-------------|
| `pipeline/02_cluster.py` | `created_datetime_ist`, `date_ist`, `hour`, `day_of_week`, `is_weekend`, `week_number` | ✓ |
| `pipeline/03a_peak_windows.py` | `hour`, `is_weekend`, `date_ist`, `day_name`, `week_number` | ✓ (all IST aliases) |
| `pipeline/03b_classify_hotspots.py` | `date_ist`, `is_weekend` | ✓ |
| `agents/plan_generator.py` | Uses `peak_window` from M3 output — already IST | ✓ |

---

## 6. Conversion method summary

```python
# Step 1: preserve raw string (new)
df["created_datetime_raw"] = df["created_datetime"].astype(str)

# Step 2: parse as UTC
# utc=True handles +00 offset-aware strings AND naive strings (treats as UTC)
df["created_datetime_utc"] = pd.to_datetime(
    df["created_datetime"], errors="coerce", utc=True
)

# Step 3: single tz_convert — never re-convert downstream
df["created_datetime_ist"] = df["created_datetime_utc"].dt.tz_convert("Asia/Kolkata")

# Step 4: derive all operational fields from IST
df["hour_ist"]    = df["created_datetime_ist"].dt.hour.astype("int32")
df["weekday_ist"] = df["created_datetime_ist"].dt.weekday.astype("int32")
df["is_weekend"]  = df["weekday_ist"].isin([5, 6]).astype(int)
# ... etc.
```

---

## 7. Validation results

| Check | Result |
|-------|--------|
| `python -m compileall pipeline agents app` | **PASS** |
| `python agents/scheduler.py --now --auto-approve --auto-dispatch` | **PASS** |
| Cleaned rows | **298,277** (unchanged) |
| Cluster count | **1,084** (unchanged) |
| `cleaned_violations.parquet` has all required columns | **PASS** |
| IST offset verification (UTC + 5h30m) | **PASS** |
| `final_end_to_end_validation.py` | **24/24 PASS** |
| `pytest` regression suite | **109/109 PASS** |
| Master plan assignments | **410** (unchanged) |
| M10 routing mode | **graph** (unchanged) |
| M15 wired | **true** (unchanged) |

---

## 8. Remaining limitations

| Limitation | Detail |
|------------|--------|
| `date_ist` stores Python `datetime.date` objects | Written to parquet/CSV as strings (`2023-11-10`); `pd.to_datetime()` handles them fine downstream. No issue. |
| Peak hours at 2–4am IST | Correct — police entered violations in the evening IST (UTC 20:30–22:30), which is 2–4am IST. This is real enforcement scheduling data. |
| No real-time TZ guard | The anti-double-conversion protection is a comment + naming convention, not a runtime check. If P1 is ever called with an already-IST column, the wrong result would be produced silently. Recommend adding a dtype assertion if this becomes a concern. |
| Other timestamps not converted | `action_taken_timestamp`, `closed_datetime`, `modified_datetime` are parsed as UTC but NOT converted to IST — they are mostly NULL in the anonymized dataset and not used in analysis. |
