# M12 Feedback Loop Backend Report

## 1. Executive Verdict

**PASS** — M12 Feedback Loop backend is initialised, seeded, and validated.

---

## 2. Files Created

| File | Purpose |
|------|---------|
| `app/officer/feedback_backend.py` | Core M12 backend — DB init, insert, query, summary, CLI |
| `app/utils/db_helpers.py` | Shared SQLite helpers (connection manager, table/index checks) |
| `tests/test_feedback_backend.py` | Unit tests for core functions |
| `data/outputs/feedback.sqlite` | SQLite event store |
| `data/outputs/feedback_summary_for_scoring.csv` | Scoring contract output |
| `reports/M12_FEEDBACK_BACKEND_REPORT.md` | This report |

---

## 3. SQLite Database

**Path:** `data/outputs/feedback.sqlite`
**Table:** `feedback_events`
**Total events (at report time):** 5
**Indexes:** idx_fe_cluster_id, idx_fe_feedback_date, idx_fe_cluster_date, idx_fe_recurred

---

## 4. Schema — feedback_events

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-assigned event id |
| `cluster_id` | TEXT | NOT NULL | Must exist in scored_hotspots |
| `feedback_date` | TEXT | NOT NULL | YYYY-MM-DD |
| `feedback_timestamp_ist` | TEXT | NOT NULL | ISO-like IST datetime |
| `assigned_station` | TEXT | — | Police station |
| `officer_id` | TEXT | — | Optional officer identifier |
| `action_type` | TEXT | NOT NULL | patrol / towing / challan / signage_review / infra_review / joint_operation / other |
| `enforcement_done` | INTEGER | NOT NULL DEFAULT 0 | 0/1 boolean |
| `outcome` | TEXT | NOT NULL | improved / no_change / worse / recurred / unknown |
| `recurred_after_enforcement` | INTEGER | NOT NULL DEFAULT 0 | **Key field** — see rule below |
| `recurrence_window_days` | INTEGER | — | Optional: 7 / 14 / 30 |
| `notes` | TEXT | — | Free-text officer notes |
| `source` | TEXT | NOT NULL DEFAULT 'backend' | backend / demo_seed / api / etc. |
| `created_at_ist` | TEXT | NOT NULL | Auto-filled IST timestamp |

---

## 5. Keying Policy

- Feedback is **event-level**, keyed by auto-increment `id`.
- **Multiple events per `cluster_id` are allowed** (same hotspot, different patrol dates).
- **No unique constraint on `(cluster_id, feedback_date)`** — multiple actions
  may occur for the same cluster on the same day (e.g., morning patrol + evening tow).
- **Piyush must aggregate by `cluster_id`** when incorporating feedback into scoring.
  The canonical function for this is `get_feedback_summary_for_scoring()`.

---

## 6. Definition: Enforced But Recurred

A cluster is considered **enforced but recurred** if:

```sql
enforcement_done = 1 AND recurred_after_enforcement = 1
```

Equivalently:

```sql
enforcement_done = 1 AND outcome = 'recurred'
```

**Consistency rule (enforced by the backend):**
- When `outcome = 'recurred'`, `recurred_after_enforcement` is **automatically set to 1**.
- `recurred_after_enforcement = 1` with `outcome != 'recurred'` raises a `ValueError`
  (only `'unknown'` is allowed as an edge case).

---

## 7. How Piyush Should Consume Feedback in 05_score.py

```python
from app.officer.feedback_backend import get_feedback_summary_for_scoring

# Load feedback summary (one row per cluster_id that has feedback)
feedback = get_feedback_summary_for_scoring()

# Merge onto scored_hotspots
df = df.merge(feedback, on='cluster_id', how='left')

# Apply structural boost
# feedback_structural_boost = 1 means: enforcement was done but violations recurred
# → treat as confirmed structural/persistent problem → increase patrol priority
df['feedback_structural_boost'] = df['feedback_structural_boost'].fillna(0).astype(int)
```

**Suggested scoring adjustment:**
```python
# Example: if feedback confirms recurrence, boost recurrence weight by 10%
df['recurrence_adjusted'] = df['recurrence'] * (1 + 0.10 * df['feedback_structural_boost'])
# Or: push classification toward STRUCTURAL if boost == 1
df.loc[df['feedback_structural_boost'] == 1, 'classification'] = 'STRUCTURAL'
```

> Piyush should decide the exact weighting. The M12 backend only provides
> the `feedback_structural_boost` signal — not the scoring formula change.

---

## 8. Sample SQL Queries

```sql
-- All feedback for one cluster
SELECT * FROM feedback_events
WHERE cluster_id = 'C_0_0'
ORDER BY feedback_timestamp_ist ASC;

-- All enforced-but-recurred clusters
SELECT DISTINCT cluster_id FROM feedback_events
WHERE enforcement_done = 1 AND recurred_after_enforcement = 1;

-- Aggregate summary by cluster_id
SELECT
    cluster_id,
    COUNT(*)                        AS feedback_event_count,
    SUM(enforcement_done)           AS enforcement_done_count,
    SUM(recurred_after_enforcement) AS recurred_after_enforcement_count,
    MAX(feedback_date)              AS last_feedback_date
FROM feedback_events
GROUP BY cluster_id
ORDER BY recurred_after_enforcement_count DESC;
```

---

## 9. Validation Results

| Check | Status |
|-------|--------|
| feedback.sqlite created | PASS |
| feedback_events table exists | PASS |
| Indexes created | 4 indexes — PASS |
| Sample insert works (demo seed) | PASS — 5 events |
| cluster_id validation works | PASS — invalid IDs raise ValueError |
| Summary export works | PASS — feedback_summary_for_scoring.csv written |
| Clusters with feedback_structural_boost = 1 | 1 |

---

## 10. Limitations

- **No dashboard/form UI yet.** Feedback must be inserted via Python API
  (`insert_feedback`) or direct SQL. A field officer form is a future task.
- **Feedback is manually inserted at backend level.** There is no automatic
  enforcement outcome capture — an officer must log the outcome explicitly.
- **Does not directly modify scoring yet.** Piyush must update `05_score.py`
  to call `get_feedback_summary_for_scoring()` and apply the boost.
- **`feedback_structural_boost` is binary (0/1).** A more nuanced weight
  (e.g., boosting proportional to recurrence count) can be added later.
- **No authentication.** `officer_id` is a free-text field with no user table.
  A proper auth system would link officer_id to a users table.

---

## 11. Final Recommendation

M12 backend is **ready for integration**.

- **Prakhar** can begin inserting real feedback as field data arrives.
- **Piyush** should import `get_feedback_summary_for_scoring` in `05_score.py`
  and merge the `feedback_structural_boost` column into the scoring loop.
- The SQLite database is safe to re-initialise (`--init` is idempotent).
- The summary CSV is regenerated fresh on each `--summary` call.
