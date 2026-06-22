import routesMock from '@/data/mock/patrol_routes.sample.json'
import type { ApiPatrolRoute, RoutesResponse } from '@/types/api'
import { formatPatrolWindow } from '@/lib/timezone'
import { apiGet } from './apiClient'

const mockRoutesResponse: RoutesResponse = {
  ok: true,
  metadata: { routing_mode_used: 'graph' },
  routes: (routesMock as { routes: Array<Record<string, unknown>> }).routes.map((r) => ({
    route_id: String(r.route_id ?? ''),
    assigned_station: String(r.assigned_station ?? ''),
    routing_mode: String(r.routing_mode ?? 'OSM_GRAPH'),
    estimated_route_km: Number(r.total_distance_km ?? 0),
    estimated_total_minutes: Number(r.estimated_duration_min ?? 0),
    stops: (r.stops as Array<Record<string, unknown>> | undefined)?.map((s, i) => ({
      sequence: Number(s.order ?? i + 1),
      cluster_id: String(s.cluster_id ?? ''),
      lat: Number(s.centroid_lat ?? 0),
      lng: Number(s.centroid_lng ?? 0),
      roi_score: Number(s.roi_score ?? 0),
      peak_window: formatPatrolWindow(String(s.peak_window ?? '')) ?? String(s.peak_window ?? ''),
      recommended_action: String(s.recommended_action ?? ''),
    })),
  })),
}

export async function getRoutes(): Promise<RoutesResponse> {
  return apiGet('/api/routes', mockRoutesResponse)
}

export async function getRoutesByStation(station: string): Promise<ApiPatrolRoute | null> {
  const fallback =
    mockRoutesResponse.routes.find(
      (r) => r.assigned_station?.toUpperCase() === station.toUpperCase(),
    ) ?? null
  return apiGet(
    `/api/routes/station/${encodeURIComponent(station)}`,
    fallback,
  )
}
