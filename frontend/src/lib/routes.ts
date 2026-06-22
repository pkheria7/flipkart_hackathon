import type { ApiPatrolRoute, ApiPatrolStop } from '@/types/api'
import { formatPatrolWindow } from '@/lib/timezone'
import type { CommandHotspot, RouteLine } from './hotspots'
import { normalizeClassification } from './hotspots'

function stopLng(s: ApiPatrolStop): number | null {
  const v = s.lng ?? s.centroid_lng
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null
}
function stopLat(s: ApiPatrolStop): number | null {
  const v = s.lat ?? s.centroid_lat
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null
}

/**
 * Convert an API route into a draw-ready RouteLine.
 * Returns null when there are fewer than 2 valid coordinates (overlay hidden gracefully).
 */
export function toRouteLine(route: ApiPatrolRoute | undefined | null): RouteLine | null {
  if (!route?.stops?.length) return null
  const stops: RouteLine['stops'] = []
  const coordinates: Array<[number, number]> = []

  route.stops
    .slice()
    .sort((a, b) => (a.sequence ?? a.order ?? 0) - (b.sequence ?? b.order ?? 0))
    .forEach((s, i) => {
      const lng = stopLng(s)
      const lat = stopLat(s)
      if (lng === null || lat === null) return
      coordinates.push([lng, lat])
      stops.push({
        cluster_id: String(s.cluster_id ?? ''),
        lng,
        lat,
        order: Number(s.sequence ?? s.order ?? i + 1),
      })
    })

  if (coordinates.length < 2) return null

  return {
    route_id: String(route.route_id ?? route.assigned_station ?? 'route'),
    station: String(route.assigned_station ?? '—'),
    routing_mode: String(route.routing_mode ?? '—'),
    coordinates,
    stops,
  }
}

/** Build lightweight map markers from a route's stops (for the station route map). */
export function routeStopHotspots(route: ApiPatrolRoute | undefined | null): CommandHotspot[] {
  if (!route?.stops?.length) return []
  const out: CommandHotspot[] = []
  for (const s of route.stops) {
    const lng = stopLng(s)
    const lat = stopLat(s)
    if (lng === null || lat === null) continue
    const classRaw = (s as { classification?: string }).classification
    out.push({
      cluster_id: String(s.cluster_id ?? ''),
      lat,
      lng,
      station: String(route.assigned_station ?? '—'),
      classification: normalizeClassification(classRaw),
      roi: typeof s.roi_score === 'number' ? s.roi_score : 0,
      violations: 0,
      lcle: null,
      bci: null,
      persistence: null,
      recurrence: null,
      osm_coverage: null,
      vehicle_mix: null,
      peak_window: formatPatrolWindow(s.peak_window) ?? null,
      road_class: null,
      road_width_m: null,
      recommended_action: s.recommended_action ?? null,
      escalation_boost: false,
      location_mode: null,
      junction_name_mode: null,
      raw: { cluster_id: String(s.cluster_id ?? '') },
    })
  }
  return out
}
