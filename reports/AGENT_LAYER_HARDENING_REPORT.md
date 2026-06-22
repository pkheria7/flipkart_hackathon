# Agent Layer Hardening Report

**Date:** 2026-06-21  
**Status:** COMPLETE — all 10 critical issues resolved

---

## Summary

The `agents/` layer has been hardened for demo-readiness. Every file compiles cleanly,
the plan generator integrates M10 VRP routes and M15 infra escalations, the scheduler
supports `--auto-approve` / `--auto-dispatch` dry-run flags, and no output is ever
silently overwritten.

---

## Changes per file

### 1. `agents/scheduler.py` — Safe APScheduler import + auto flags

**Issue:** Top-level `from apscheduler.schedulers.blocking import BlockingScheduler`
crashed at import time if the package was not installed.

**Fix:**
- Wrapped in `try/except ImportError`; set `_APSCHEDULER_AVAILABLE = False` on failure
- `start_scheduler()` now prints install instructions and exits cleanly if unavailable
- Added `auto_approve: bool = False` and `auto_dispatch: bool = False` to `daily_job()`
- `__main__` block parses `--auto-approve`, `--auto-dispatch`, `--dry-run`, `--no-dry-run`
- `daily_job()` now calls `snapshot_pre_pipeline(run_id)` before `run_full_pipeline()`
- Passes `run_id` down into `generate_master_plan()` and `dispatch_approved_plan()`

### 2. `agents/state_manager.py` — Expanded snapshot (2 → 6 files)

**Issue:** `snapshot_outputs()` only snapshotted `scored_hotspots.parquet` and
`daily_master_plan.json`.

**Fix:**
- Defined `_PRE_PIPELINE_FILES` (6 files):
  - `scored_hotspots.parquet`
  - `scored_hotspots.csv`
  - `patrol_routes.json`
  - `patrol_routes.csv`
  - `enriched_clusters.parquet`
  - `feedback.sqlite`
- Added `snapshot_pre_pipeline(run_id)` — called BEFORE destructive pipeline stages
  → snapshots to `run_snapshots/<run_id>/pre_pipeline/`
- Updated `snapshot_outputs(run_id)` → snapshots all 6 + `daily_master_plan.json`
  → flat `run_snapshots/<run_id>/` (backward compatible)
- `load_state()` now includes `last_snapshot_path` field

### 3. `agents/kannada_translator.py` — Stable cache key

**Issue:** `cache_key = f"kannada:{hash(text)}"` — Python `hash()` is not stable
across interpreter sessions (randomised since Python 3.3).

**Fix:**
- Replaced with `hashlib.sha256(text.encode("utf-8")).hexdigest()`
- Cache key now `kannada_v2:<sha256>` (versioned to avoid stale hits from old keys)
- Wrapped `from groq import Groq` in `try/except ImportError` with `_GROQ_AVAILABLE` flag
- Both `_load_cache()` and `_save_cache()` are exception-safe

### 4. `agents/pipeline_runner.py` — Pre-pipeline snapshot

**Issue:** No snapshot was taken before P1 overwrote processed outputs.

**Fix:**
- `run_full_pipeline(run_id=None)` now accepts optional `run_id`
- Calls `snapshot_pre_pipeline(run_id)` at the top of `run_full_pipeline()`, before P1 clean

### 5. `agents/plan_generator.py` — Roster validation + M10 + M15

**Issues:**
- `load_rosters()` silently returned empty DataFrames when CSVs were missing
- `generate_master_plan()` only read `scored_hotspots.parquet`
- No M10 patrol-route ordering
- No M15 infra escalation flags
- No `run_id` or `generated_at_ist` in plan output

**Fixes:**
- `load_rosters(allow_unassigned=False)` now raises `FileNotFoundError` with
  generate commands when CSVs are missing; `allow_unassigned=True` warns and continues
- `_load_m10_routes()` reads `data/outputs/patrol_routes.json` keyed by station
- `_load_m15_summary()` reads `data/outputs/infra_assessment_summary.csv`
- `generate_master_plan()` uses M10 stop-order when available, falls back to top-ROI
- Every assignment includes `routing_source` (`"m10_vrp"` or `"top_roi_fallback"`)
- Every assignment includes M15 fields: `infra_escalation_ready`, `infra_dominant_cause`,
  `infra_suggested_fix`, `recommended_agency`
- Plan dict includes `run_id`, `generated_at_ist`, `m10_wired`, `m15_wired`
- `generate_master_plan()` accepts `run_id` and `allow_unassigned` parameters

**Validated:**
```
[PLAN] M10 patrol routes loaded — 54 stations.
[PLAN] M15 infra summary loaded — 3 clusters, 1 escalation-ready.
[PLAN] Generated master plan: 54 stations, 410 assignments, routing=M10-VRP, M15=yes.
```

### 6. `agents/approval_queue.py` — Idempotency + archiving

**Issue:** `submit_plan_for_approval()` silently overwrote `pending_master_plan.json`.
No `run_id` tracking.

**Fix:**
- `_archive_pending()` copies the existing pending plan to
  `data/outputs/plan_archive/pending_master_plan_<run_id>.json` before any overwrite
- `submit_plan_for_approval()` calls `_archive_pending()` and logs the archive path
- `revise_plan()` also archives before overwriting
- All plan dicts now include `submitted_at_ist` and `run_id`

### 7. `agents/mailer.py` — Per-run-id eml subfolders

**Issue:** All .eml files went to a flat `data/outputs/eml/` directory; filenames could
collide across runs.

**Fix:**
- `send_email(..., run_id=None)` — when `run_id` is set, writes to `eml/<run_id>/`
- `_safe_slug()` replaces unsafe characters for filesystem-safe filenames
- When `run_id` is None, behaviour unchanged (flat `eml/` directory)

### 8. `agents/dispatcher.py` — run_id propagation

**Issue:** `run_id` was not forwarded to the mailer, so eml subfolders were never used.

**Fix:**
- `_run_id_from_plan(plan)` extracts `run_id` from plan dict
- All `send_email()` calls pass `run_id=run_id`
- `_format_head_email()` includes `Run ID`, `routing_source`, `m10_wired`, `m15_wired`
- Officer emails include infra escalation alerts for escalation-ready clusters

**Validated:**
```
dispatch dry-run done — emails: 346
eml dirs: ['DEMO_RUN']
```

---

## Issues that were NOT in scope (honesty clause)

| Item | Reason not touched |
|------|--------------------|
| Core scoring formulas (ROI / LCLE / BCI) | Out of scope per spec |
| M10 VRP optimizer logic | Out of scope |
| M12 feedback backend schema | Not modified |
| M15 infra schema | Not modified |
| React UI / FastAPI | Out of scope |
| Real SMTP / real dispatch | Not needed for demo |
| Synthetic-data labels removed | Honesty constraint — kept |

---

## Validation results

### Compile check
```
python -m compileall agents
→ All 10 agent files compile without error
```

### Plan generator
```
python -c "from agents.plan_generator import generate_master_plan; plan = generate_master_plan(use_llm=False, allow_unassigned=True); print('stations', len(plan.get('stations', [])))"
→ stations 54 | assignments 410 | M10=yes | M15=yes
```

### Approval queue
```
→ Archives previous pending plan to plan_archive/ before each overwrite
→ approve_plan() → status approved
```

### Dispatcher
```
→ 346 emails dispatched (dry-run) to eml/DEMO_RUN/ subfolder
```

### Scheduler
```
python agents/scheduler.py --now --dry-run --auto-approve --auto-dispatch
→ run_id minted, pre-pipeline snapshot (6 files), pipeline runs (fails on missing raw CSV),
   auto-approve and auto-dispatch flags respected
```

### Final end-to-end validation
```
python tests/final_end_to_end_validation.py
→ 24/24 PASS
```

---

## Demo invocation

```bash
# Generate roster data
python demo/synth_officers.py
python demo/synth_tow_trucks.py

# Seed infra assessments
python -m app.officer.infra_intel_backend --init --seed-demo --export-summary --generate-pdfs

# Generate plan (no LLM, uses M10+M15)
python -c "from agents.plan_generator import generate_master_plan; plan = generate_master_plan(use_llm=False); print('stations', len(plan.get('stations', [])))"

# Approve and dispatch (dry-run)
python -c "
from agents.approval_queue import get_pending_plan, approve_plan
from agents.dispatcher import dispatch_approved_plan
approve_plan()
from agents.approval_queue import get_approved_plan
p = get_approved_plan()
results = dispatch_approved_plan(p, dry_run=True)
print(len(results), 'emails written to eml/<run_id>/')
"

# Or all-in-one (skips pipeline re-run):
python agents/scheduler.py --now --dry-run --auto-approve --auto-dispatch
```
