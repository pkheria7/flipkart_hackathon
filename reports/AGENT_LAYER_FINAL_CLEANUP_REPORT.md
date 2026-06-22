# Agent Layer Final Cleanup Report

**Date:** 2026-06-21  
**Final run_id:** `20260621_201243`  
**Status:** COMPLETE — all consistency issues resolved, all validations pass

---

## Issues fixed

### 1. `m10_routing_mode` showed `"haversine"` despite graph routing being active

**Root cause:**  
`patrol_routes.json` stores the routing mode in `metadata.routing_mode_used` at the top
level. Individual route objects do not carry this field. The old `plan_generator.py` was
reading `m10_route.get("routing_mode_used", ...)` from each route dict — which always
fell back to `"haversine"`.

**Fix (`agents/plan_generator.py`):**  
- Changed `_load_m10_routes()` signature from `dict[str, dict]` to
  `tuple[dict[str, dict], str]`, returning `(routes_by_station, global_routing_mode)`.
- `global_routing_mode` is read from `data.get("metadata", {}).get("routing_mode_used", "haversine")`.
- All route `m10_route_meta` dicts now use `m10_global_routing_mode` instead of the
  broken per-route lookup.
- Top-level plan dict now includes `"m10_routing_mode": "graph"`.

**Verified:** graph file at `cache/bengaluru_drive_graph.graphml` (282 MB) was already
being used by M10. `patrol_routes.json` metadata already showed
`routing_mode_used: graph, graph_leg_count: 5006, fallback_leg_count: 0`. M10 did NOT
need to be re-run.

---

### 2. `run_id` was inconsistent across agent outputs

**Before fix:**

| File | run_id |
|------|--------|
| `daily_master_plan.json` | `null` |
| `pending_master_plan.json` | `"DEMO_RUN"` (test artifact) |
| `approved_master_plan.json` | `"DEMO_RUN"` (test artifact) |
| `agent_state.json` `last_run_id` | `"20260621_142447"` (scheduler test) |
| `eml/` | `DEMO_RUN/` subfolder |

**Root cause:** `generate_master_plan()` defaulted `run_id=None` and did not write the
run_id to `agent_state.json`. Callers that didn't pass an explicit run_id got `null`.

**Fix (`agents/plan_generator.py`):**  
- `generate_master_plan()` now auto-generates an IST-timestamped run_id
  (`YYYYMMDD_HHMMSS`) when the caller does not provide one.
- Immediately calls `state_manager.update_run_id(run_id)` to sync `agent_state.json`.

**Fix (`agents/state_manager.py`):**  
- Added `update_run_id(run_id: str) -> None` — updates `last_run_id` in
  `agent_state.json` without incrementing `total_runs` (so standalone plan generation
  does not look like a full scheduler run).

---

### 3. No safe plan-only CLI existed

**Before:** The only way to run the agent was `scheduler.py --now`, which triggered the
full raw-data pipeline (P1→M1) and failed when the raw CSV was absent.

**Fix — `agents/demo_flow.py` (new file):**  
Safe plan-only script that does:
1. `generate_master_plan(run_id=...)` from existing backend outputs
2. `submit_plan_for_approval(plan)`
3. `approve_plan()`
4. `dispatch_approved_plan(plan, dry_run=True)`
5. Consistency check: verifies all four output files agree on the same run_id

**Fix — `agents/scheduler.py`:**  
Added `--plan-only` flag which delegates to `demo_flow.run_demo_flow()` without
touching the pipeline. `--plan-only` implies `--dry-run`.

---

## Commands run

```bash
# Compile check
python -m compileall agents
# → All 10 agent files pass

# Safe demo flow (the canonical demo command)
python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run

# Final E2E validation
python tests/final_end_to_end_validation.py

# Regression tests
pytest tests/test_feedback_backend.py tests/test_infra_intel_backend.py tests/test_vrp_optimizer.py -q
```

---

## Files changed

| File | Change |
|------|--------|
| `agents/plan_generator.py` | `_load_m10_routes()` returns tuple; auto-generate run_id; `update_run_id()` call; correct `m10_routing_mode` in plan |
| `agents/state_manager.py` | Added `update_run_id(run_id)` function |
| `agents/demo_flow.py` | **NEW** — safe plan-only demo CLI |
| `agents/scheduler.py` | Added `--plan-only` flag delegating to `demo_flow` |
| `reports/AGENT_LAYER_FINAL_CLEANUP_REPORT.md` | This report |

---

## Final output state

| Output | Value |
|--------|-------|
| `run_id` | `20260621_201243` |
| `daily_master_plan.json` run_id | `20260621_201243` ✓ |
| `pending_master_plan.json` run_id | `20260621_201243` ✓ |
| `approved_master_plan.json` run_id | `20260621_201243` ✓ |
| `agent_state.json` last_run_id | `20260621_201243` ✓ |
| `eml/<run_id>/` | `eml/20260621_201243/` — 346 files ✓ |
| `total_assignments` | 410 |
| `stations` | 54 |
| `routing_source` | `m10_vrp` |
| `m10_routing_mode` | **`graph`** (OSM NetworkX, 236 481 nodes) |
| `m10_wired` | `true` |
| `m15_wired` | `true` |
| `m15_escalation_ready_clusters` | 1 (of 3 assessed) |

---

## Validation results

| Check | Result |
|-------|--------|
| `python -m compileall agents` | **PASS** — all 10 files |
| `python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run` | **PASS** |
| Consistency check (all run_ids match) | **PASS** |
| `python tests/final_end_to_end_validation.py` | **24/24 PASS** |
| `pytest tests/test_feedback_backend.py tests/test_infra_intel_backend.py tests/test_vrp_optimizer.py` | **109/109 PASS** |

---

## Remaining limitations (honest)

| Limitation | Detail |
|------------|--------|
| Full pipeline cannot run | Raw CSV (`jan to may police violation_anonymized791b166.csv`) is not in the repo. `scheduler.py --now` always fails at P1. Use `--plan-only` or `demo_flow.py` instead. |
| Real email dispatch untested | SMTP credentials (`SMTP_USER`, `SMTP_PASS`) are not set. All email tests are dry-run only. |
| LLM explanations disabled by default | `use_llm=False` in demo flow. Enable with `--use-llm` and set `GROQ_API_KEY`. |
| Roster files synthetic | Officers and tow trucks are demo-generated; officer emails are `officer_id@example.com` placeholders. |
| M15 infra data is demo-only | Only 3 clusters assessed (demo seed). Real assessments require officer field input via `app.officer.infra_intel_backend`. |

---

## Demo invocation (canonical)

```bash
# One-command demo (no pipeline, no real emails, consistent run_id):
python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run

# Or via scheduler --plan-only:
python agents/scheduler.py --plan-only --auto-approve --auto-dispatch

# With LLM (needs GROQ_API_KEY):
python agents/demo_flow.py --use-llm --auto-approve --auto-dispatch --dry-run
```
