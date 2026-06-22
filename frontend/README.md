# GridLock Command — Frontend (Phase 0)

React/Vite foundation for the BTP Parking Impact Intelligence command center.

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Open the app at **http://localhost:5173** (port is fixed in `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

## Typecheck

```bash
npm run typecheck
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
```

- `VITE_USE_MOCK_DATA=true` — mock JSON only (no API calls).
- `VITE_USE_MOCK_DATA=false` or unset — **API first**, mock fallback on failure (logs `[API fallback]` in console).

Start the FastAPI backend before the frontend for live data:

```bash
# from repo root
uvicorn app.api.main:app --reload --port 8000
```

## Phase 1 Routes (primary navigation)

| Path | Module |
|------|--------|
| `/` | Mission Brief |
| `/command` | Command Center |
| `/intelligence` | Hotspot Intelligence |
| `/operations` | Patrol Operations |
| `/feedback-escalation` | Feedback & Escalation |
| `/impact` | Impact & Evidence |
| `/demo` | Demo Mode |
| `/hotspots/:clusterId` | Hotspot Detail |

Phase 0 legacy URLs (`/priority`, `/map`, `/routes`, etc.) still work but are hidden from the sidebar.

## Mock vs API Mode

All services in `src/services/` follow a mock/API fallback pattern:

1. If `VITE_USE_MOCK_DATA` is not `false`, mock data is returned with a simulated delay.
2. Otherwise, services fetch from `VITE_API_BASE_URL` endpoints.
3. On API failure, services fall back to mock data and log a warning.

The frontend does **not** directly read `.sqlite` or `.parquet` files. Data will be provided via a backend API or exported JSON/CSV adapters.

## Folder Structure

```
frontend/
  src/
    app/          # Global providers (React Query, Router)
    pages/        # Route-level page components
    components/
      layout/     # AppShell, Sidebar, Topbar
      ui/         # GlassCard, MetricCard, StatusBadge, etc.
      map/        # MapLibre placeholders
      motion/     # Framer Motion placeholders
      charts/     # Recharts placeholders
      workflow/   # Agent timeline, approval stepper, etc.
    services/     # Data access with mock/API fallback
    types/        # TypeScript contracts aligned with backend outputs
    data/mock/    # Sample JSON for offline development
    lib/          # Utilities (cn, formatters, constants)
```

## Routes

| Path | Page |
|------|------|
| `/` | Landing / Mission Brief |
| `/login` | Head Officer Login (placeholder) |
| `/command` | Command Center |
| `/priority` | Priority Board |
| `/map` | City Hotspot Map |
| `/hotspots/:clusterId` | Hotspot Detail |
| `/routes` | Patrol Route Optimizer |
| `/master-plan` | Daily Master Plan Inbox |
| `/approval` | Plan Approval / Revision |
| `/notifications` | Dispatch Preview |
| `/officer` | Officer Mobile View |
| `/tow` | Tow Truck View |
| `/feedback` | Officer + Citizen Feedback |
| `/escalation` | Infrastructure Escalation |
| `/week-comparison` | Week 1 vs Week 2 Dashboard |
| `/run-logs` | Agent Run Logs |
| `/reports` | Reports + PDF Briefs |
| `/demo` | Guided Demo Mode |

## Backend Data Sources (future API)

The frontend is designed to consume:

- `scored_hotspots.parquet` / `.csv`
- `patrol_routes.json` / `.csv`
- `daily_master_plan.json`, `pending_master_plan.json`, `approved_master_plan.json`
- `agent_state.json`
- `feedback.sqlite` (via API)
- `infra_assessment_summary.csv`
- `eml/*.eml` (via API)
- Synthetic demo week parquet files
- Report markdown/PDF outputs
