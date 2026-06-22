import type { RoutingMode } from './common'

export interface PatrolStop {
  order: number
  cluster_id: string
  centroid_lat: number
  centroid_lng: number
  location_name?: string
  roi_score: number
  peak_window: string
  recommended_action?: string
}

export interface PatrolRoute {
  route_id: string
  assigned_station: string
  routing_mode: RoutingMode
  total_distance_km?: number
  estimated_duration_min?: number
  officer_hours?: number
  stops: PatrolStop[]
}

export interface PatrolRouteCollection {
  routes: PatrolRoute[]
  generated_at?: string
}
