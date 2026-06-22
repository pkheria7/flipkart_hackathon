/**
 * Normalizes master-plan JSON into a stable shape for the UI.
 *
 * The backend's real plan nests assignments under `stations[]`, while the mock
 * sample uses a flat `assignments[]` + `station_summaries[]`. This util accepts
 * either and always returns the same structure.
 */

export interface PlanAssignment {
  cluster_id: string
  station: string
  time_window: string | null
  officer_id: string | null
  officer_name: string | null
  tow_truck_id: string | null
  tow_driver: string | null
  action: string | null
  reason: string | null
  roi: number | null
  lcle: number | null
  bci: number | null
  classification: string | null
}

export interface PlanStationSummary {
  station: string
  count: number
  avgRoi: number | null
  structural: number
  responsive: number
}

export interface NormalizedPlan {
  runId: string | null
  generatedAt: string | null
  date: string | null
  status: string
  totalAssignments: number
  routingMode: string | null
  stationSummaries: PlanStationSummary[]
  assignments: PlanAssignment[]
}

type Dict = Record<string, unknown>

function asStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v
  if (typeof v === 'number') return String(v)
  return null
}
function asNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function mapAssignment(a: Dict, parentStation: string | null): PlanAssignment {
  return {
    cluster_id: asStr(a.cluster_id) ?? '—',
    station: asStr(a.assigned_station) ?? asStr(a.station) ?? parentStation ?? '—',
    time_window: asStr(a.time_window),
    officer_id: asStr(a.officer_id),
    officer_name: asStr(a.officer_name),
    tow_truck_id: asStr(a.tow_truck_id),
    tow_driver: asStr(a.tow_truck_driver) ?? asStr(a.tow_driver),
    action: asStr(a.action),
    reason: asStr(a.reason),
    roi: asNum(a.roi_score),
    lcle: asNum(a.lcle_pct),
    bci: asNum(a.bci),
    classification: asStr(a.classification),
  }
}

function deriveSummaries(assignments: PlanAssignment[]): PlanStationSummary[] {
  const groups = new Map<string, PlanAssignment[]>()
  for (const a of assignments) {
    const list = groups.get(a.station) ?? []
    list.push(a)
    groups.set(a.station, list)
  }
  return Array.from(groups.entries())
    .map(([station, list]) => {
      const rois = list.map((x) => x.roi).filter((x): x is number => x != null)
      return {
        station,
        count: list.length,
        avgRoi: rois.length ? rois.reduce((s, x) => s + x, 0) / rois.length : null,
        structural: list.filter((x) => (x.classification ?? '').toUpperCase() === 'STRUCTURAL').length,
        responsive: list.filter((x) => (x.classification ?? '').toUpperCase() === 'RESPONSIVE').length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function normalizeMasterPlan(
  plan: Dict | null | undefined,
  fallbackStatus?: string,
): NormalizedPlan | null {
  if (!plan || typeof plan !== 'object') return null

  const assignments: PlanAssignment[] = []
  let stationSummaries: PlanStationSummary[] = []

  if (Array.isArray(plan.stations) && plan.stations.length > 0) {
    // Real shape: assignments nested under stations[]
    for (const s of plan.stations as Dict[]) {
      const stationName = asStr(s.station) ?? '—'
      const stationAssignments = Array.isArray(s.assignments) ? (s.assignments as Dict[]) : []
      for (const a of stationAssignments) assignments.push(mapAssignment(a, stationName))
    }
    stationSummaries = deriveSummaries(assignments)
  } else if (Array.isArray(plan.assignments)) {
    // Mock/flat shape
    for (const a of plan.assignments as Dict[]) assignments.push(mapAssignment(a, null))
    if (Array.isArray(plan.station_summaries)) {
      stationSummaries = (plan.station_summaries as Dict[]).map((s) => ({
        station: asStr(s.station) ?? '—',
        count: asNum(s.assignment_count) ?? 0,
        avgRoi: asNum(s.avg_roi_score),
        structural: asNum(s.structural_count) ?? 0,
        responsive: asNum(s.responsive_count) ?? 0,
      }))
    } else {
      stationSummaries = deriveSummaries(assignments)
    }
  }

  const status =
    asStr(plan.status) ??
    fallbackStatus ??
    (assignments.length > 0 ? 'generated' : 'unknown')

  return {
    runId: asStr(plan.run_id) ?? asStr(plan.plan_id),
    generatedAt: asStr(plan.generated_at_ist) ?? asStr(plan.generated_at),
    date: asStr(plan.date),
    status,
    totalAssignments: asNum(plan.total_assignments) ?? assignments.length,
    routingMode: asStr(plan.m10_routing_mode) ?? asStr(plan.routing_source),
    stationSummaries,
    assignments,
  }
}
