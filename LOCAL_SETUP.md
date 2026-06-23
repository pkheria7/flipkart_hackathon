# GridLock Command — Local Setup

Works on **Windows (PowerShell)** and **macOS/Linux (bash/zsh)** without any code changes.

---

## Prerequisites

| Tool | Min version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| pyarrow | any (parquet engine) |

---

## 1 — Clone & enter the repo

```bash
git clone <repo-url>
cd flipkart_hackathon
```

---

## 2 — Python backend

### macOS / Linux

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> **Tip — parquet support:** `pyarrow` is required to read `.parquet` files.
> If it isn't in your environment: `pip install pyarrow`
> The backend will automatically fall back to the `.csv` copy if parquet fails.

---

## 3 — Verify local data setup

```bash
python scripts/check_local_setup.py
```

Expected output ends with **PASS — All checks passed**.

If `total_hotspots = 0` or files are missing, regenerate outputs:

```bash
python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run
```

---

## 4 — Start the API server

```bash
python -m uvicorn app.api.main:app --reload --port 8000
```

The API is ready when you see `Application startup complete`.

---

## 5 — Verify API endpoints (optional, in a second terminal)

```bash
python scripts/check_api_endpoints.py
```

Expected output ends with **PASS — All endpoint checks passed**.

To target a different host:

```bash
API_BASE_URL=http://localhost:8000 python scripts/check_api_endpoints.py
```

---

## 6 — Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # first time only
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

`.env.local` defaults (already set in `.env.example`):

```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
VITE_DEMO_VIDEO_URL=https://www.youtube.com/watch?v=QPVqnaJB3R0
```

---

## 7 — Production build check

```bash
cd frontend
npm run build
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Dashboard shows 0 hotspots | API returns `[]` | Check uvicorn terminal for `[readers]` lines; install `pyarrow` |
| Station dropdown empty | Fewer than all hotspots fetched | API `limit` default is 1500; ensure API is reachable |
| `ModuleNotFoundError: pyarrow` | Parquet engine missing | `pip install pyarrow` |
| CORS error in browser | Wrong `VITE_API_BASE_URL` | Ensure `.env.local` has `VITE_API_BASE_URL=http://localhost:8000` |
| `scored_hotspots.parquet` missing | Pipeline hasn't run | Run `python agents/demo_flow.py --auto-approve --auto-dispatch --dry-run` |
| API not reachable | Wrong port / not started | `python -m uvicorn app.api.main:app --reload --port 8000` |
