"""
FastAPI endpoint sanity test for GridLock Command.

Assumes the API is already running. Run:
    python scripts/check_api_endpoints.py

Override base URL:
    API_BASE_URL=http://localhost:8000 python scripts/check_api_endpoints.py
"""

from __future__ import annotations

import os
import sys
import json

try:
    import urllib.request as _req
    import urllib.error as _err
except ImportError:
    sys.exit("urllib not available — use Python 3.x")

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"

BASE = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")

_failures = 0


def section(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def check(path: str, *, expect_list: bool = False, min_rows: int = 0) -> dict | list | None:
    global _failures
    url = f"{BASE}{path}"
    try:
        with _req.urlopen(url, timeout=10) as resp:
            status = resp.status
            raw = resp.read()
            data = json.loads(raw)
    except _err.HTTPError as e:
        _failures += 1
        print(f"  {FAIL}  {path:45s} HTTP {e.code}")
        return None
    except _err.URLError as e:
        _failures += 1
        print(f"  {FAIL}  {path:45s} connection error — is API running at {BASE}? ({e.reason})")
        return None
    except Exception as e:
        _failures += 1
        print(f"  {FAIL}  {path:45s} {e}")
        return None

    if status != 200:
        _failures += 1
        print(f"  {FAIL}  {path:45s} HTTP {status}")
        return None

    # Row count for list responses
    if expect_list or isinstance(data, list):
        count = len(data) if isinstance(data, list) else len(data.get("routes", data.get("data", [])))
        ok_flag = count >= min_rows
        marker = PASS if ok_flag else FAIL
        if not ok_flag:
            _failures += 1
        print(f"  {marker}  {path:45s} HTTP {status}  rows={count}")
        return data

    # Dict response — check for ok flag or just report
    ok_field = data.get("ok", True) if isinstance(data, dict) else True
    marker = PASS if ok_field else WARN
    summary_val = ""
    if isinstance(data, dict):
        if "total_hotspots" in data:
            summary_val = f" total_hotspots={data['total_hotspots']}"
        elif "service" in data:
            summary_val = f" service={data['service']!r}"
        elif "plan_status" in data:
            summary_val = f" plan_status={data.get('plan_status')!r}"
    print(f"  {marker}  {path:45s} HTTP {status}{summary_val}")
    return data


section(f"GridLock API endpoint checks  →  {BASE}")

check("/api/health")
check("/api/summary")
check("/api/hotspots/summary")
check("/api/hotspots?sort_by=roi_score&limit=5", expect_list=True, min_rows=5)
check("/api/hotspots?sort_by=roi_score&limit=1500", expect_list=True, min_rows=1)
check("/api/routes")
check("/api/master-plan/approved")
check("/api/master-plan/daily")
check("/api/infra/escalation-candidates", expect_list=True)
check("/api/infra/pdfs", expect_list=True)

section("Result")
if _failures == 0:
    print(f"\n  {PASS}  All endpoint checks passed.\n")
else:
    print(f"\n  {FAIL}  {_failures} endpoint(s) failed — see above.\n")
    sys.exit(1)
