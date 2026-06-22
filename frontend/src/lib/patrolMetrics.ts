/**
 * Deterministic patrol route metric calculations.
 *
 * All labels are transparent about being estimates:
 *  - distance uses haversine (straight-line between stops)
 *  - duration = haversine travel time + per-stop service time
 *  - officer-hours = durationMinutes / 60 × officerCount (default 2)
 *  - patrol window = dominant/earliest peak window across stops
 */
import type { CommandHotspot, RouteLine } from './hotspots'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Urban patrol speed in km/h (motorcycle/vehicle patrol in dense urban area). */
const PATROL_SPEED_KMH = 15

/** Per-stop service time (enforcement dwell) in minutes, by classification. */
const STOP_SERVICE_MIN: Record<string, number> = {
  STRUCTURAL: 11,
  RESPONSIVE: 7,
  SEASONAL: 5,
}
const DEFAULT_STOP_SERVICE_MIN = 6

/** Default number of officers per patrol unit. */
const DEFAULT_OFFICER_COUNT = 2

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)))
}

/** Parse a peak window string like "08:00–10:00" into a start hour (for sorting). */
function peakWindowStartHour(w: string): number {
  const match = w.match(/(\d{1,2}):(\d{2})/)
  return match ? parseInt(match[1], 10) + parseInt(match[2], 10) / 60 : 99
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface PatrolMetrics {
  /** Straight-line haversine sum between stop sequence (km, 1 d.p.). */
  approxDistanceKm: number
  /** Travel time only (minutes). */
  travelMinutes: number
  /** Time at all stops combined (minutes). */
  serviceMinutes: number
  /** Total estimated patrol duration (minutes). */
  totalMinutes: number
  /** Officer-hours = ceil(totalMinutes / 60) × officerCount. */
  officerHours: number
  /** Number of officers assumed. */
  officerCount: number
  /** Dominant/earliest peak patrol window derived from stops, or null. */
  suggestedPatrolWindow: string | null
  /** Number of stops in the route. */
  stopCount: number
}

/**
 * Compute patrol metrics for a RouteLine combined with hotspot data.
 *
 * If `apiDistanceKm` and `apiDurationMin` are provided (from the server-side
 * route computation), they are used instead of haversine estimates.
 */
export function calcPatrolMetrics(
  route: RouteLine,
  stopHotspots: CommandHotspot[],
  opts: {
    apiDistanceKm?: number | null
    apiDurationMin?: number | null
    officerCount?: number
  } = {},
): PatrolMetrics {
  const { apiDistanceKm, apiDurationMin, officerCount = DEFAULT_OFFICER_COUNT } = opts
  const lookup = new Map(stopHotspots.map((h) => [h.cluster_id, h]))

  const coords = route.coordinates
  const stops = route.stops

  // Distance
  let approxDistanceKm: number
  if (apiDistanceKm != null && apiDistanceKm > 0) {
    approxDistanceKm = Math.round(apiDistanceKm * 10) / 10
  } else {
    let total = 0
    for (let i = 0; i < coords.length - 1; i++) {
      total += haversineKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
    }
    approxDistanceKm = Math.round(total * 10) / 10
  }

  // Service time per stop
  let serviceMinutes = 0
  const peakWindows: string[] = []
  for (const stop of stops) {
    const h = lookup.get(stop.cluster_id)
    const cls = h?.classification?.toUpperCase() ?? ''
    serviceMinutes += STOP_SERVICE_MIN[cls] ?? DEFAULT_STOP_SERVICE_MIN
    if (h?.peak_window) peakWindows.push(h.peak_window)
  }

  // Travel time
  const travelMinutes = Math.round((approxDistanceKm / PATROL_SPEED_KMH) * 60)

  // Total
  const totalMinutes =
    apiDurationMin != null && apiDurationMin > 0
      ? Math.round(apiDurationMin)
      : travelMinutes + serviceMinutes

  // Officer-hours
  const officerHours = Math.max(1, Math.ceil(totalMinutes / 60)) * officerCount

  // Suggested patrol window — earliest peak window
  let suggestedPatrolWindow: string | null = null
  if (peakWindows.length > 0) {
    // Most frequent window, tie-broken by earliest start
    const freq = new Map<string, number>()
    for (const w of peakWindows) freq.set(w, (freq.get(w) ?? 0) + 1)
    const sorted = Array.from(freq.entries()).sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : peakWindowStartHour(a[0]) - peakWindowStartHour(b[0]),
    )
    suggestedPatrolWindow = sorted[0][0]
  }

  return {
    approxDistanceKm,
    travelMinutes,
    serviceMinutes,
    totalMinutes,
    officerHours,
    officerCount,
    suggestedPatrolWindow,
    stopCount: stops.length,
  }
}
