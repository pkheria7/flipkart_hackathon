import type { CommandHotspot, RouteLine } from './hotspots'

export interface StationOption {
  id: string
  label: string
  count: number
  structural: number
  maxRoi: number
  totalViolations: number
}

/** Derive stations that have hotspot data, sorted by total violations descending (worst first). */
export function getStationsWithHotspots(hotspots: CommandHotspot[]): StationOption[] {
  const map = new Map<string, { count: number; structural: number; maxRoi: number; totalViolations: number }>()
  for (const h of hotspots) {
    if (!h.station || h.station === '—') continue
    const e = map.get(h.station) ?? { count: 0, structural: 0, maxRoi: 0, totalViolations: 0 }
    map.set(h.station, {
      count: e.count + 1,
      structural: e.structural + (h.classification === 'STRUCTURAL' ? 1 : 0),
      maxRoi: Math.max(e.maxRoi, h.roi),
      totalViolations: e.totalViolations + h.violations,
    })
  }
  return Array.from(map.entries())
    .map(([id, s]) => ({ id, label: id.replace(/_/g, ' '), ...s }))
    .sort((a, b) =>
      b.totalViolations !== a.totalViolations
        ? b.totalViolations - a.totalViolations
        : b.structural !== a.structural
          ? b.structural - a.structural
          : b.maxRoi - a.maxRoi,
    )
}

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

export function routeDistanceKm(coords: Array<[number, number]>): number {
  let total = 0
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
  }
  return Math.round(total * 10) / 10
}

/**
 * Build a deterministic patrol route from top station hotspots.
 * Used when no API route exists for the station.
 * Ordering: structural first, then by peak window, then by ROI.
 */
export function buildDemoPatrolRoute(
  hotspots: CommandHotspot[],
  stationId: string,
): RouteLine | null {
  const top = hotspots.slice(0, 8)
  if (top.length < 2) return null

  const ordered = [...top].sort((a, b) => {
    const sA = a.classification === 'STRUCTURAL' ? 0 : 1
    const sB = b.classification === 'STRUCTURAL' ? 0 : 1
    if (sA !== sB) return sA - sB
    const wA = a.peak_window ?? 'ZZ'
    const wB = b.peak_window ?? 'ZZ'
    if (wA !== wB) return wA.localeCompare(wB)
    return b.roi - a.roi
  })

  const stops: RouteLine['stops'] = ordered.map((h, i) => ({
    cluster_id: h.cluster_id,
    lng: h.lng,
    lat: h.lat,
    order: i + 1,
  }))
  const coordinates: Array<[number, number]> = ordered.map((h) => [h.lng, h.lat])

  return {
    route_id: `ROUTE_${stationId}_001`,
    station: stationId,
    routing_mode: 'Graph',
    coordinates,
    stops,
  }
}
