export interface HealthResponse {
  ok: boolean
  service: string
  mode: string
  timestamp: string
  key_files: Record<string, boolean>
}

export interface SummaryResponse {
  total_hotspots: number
  structural_count: number
  responsive_count: number
  seasonal_count: number
  average_roi: number
  average_lcle: number
  average_bci: number
  total_violations: number
  total_assignments: number
  total_stations: number
  plan_status: string
  last_run_id?: string | null
  m10_wired: boolean
  m15_wired: boolean
  routing_mode?: string | null
}

export interface HotspotSummaryResponse {
  ok: boolean
  message?: string
  total_hotspots?: number
  classification_counts?: Record<string, number>
  average_roi_score?: number | null
  average_lcle?: number | null
  average_bci?: number | null
  total_violations?: number | null
  stations?: number | null
  data?: null
}

export interface ApiHotspot {
  cluster_id: string
  centroid_lat?: number | null
  centroid_lng?: number | null
  assigned_station?: string | null
  border_flag?: number | null
  road_class?: string | null
  road_width_m?: number | null
  osm_coverage?: number | null
  violation_count?: number | null
  vehicle_mix?: string | null
  lcle_pct?: number | null
  bci?: number | null
  persistence?: number | null
  recurrence?: number | null
  peak_window?: string | null
  roi_score?: number | null
  classification?: string | null
  recommended_action?: string | null
  feedback_structural_boost?: number | null
  /** Most common raw address string within the cluster (from cluster_summary). */
  location_mode?: string | null
  /** Most common junction name within the cluster (from cluster_summary). */
  junction_name_mode?: string | null
}

export interface RoutesResponse {
  ok: boolean
  metadata?: Record<string, unknown>
  routes: ApiPatrolRoute[]
  message?: string
  data?: null
}

export interface ApiPatrolRoute {
  route_id?: string
  assigned_station?: string
  routing_mode?: string
  stop_count?: number
  estimated_route_km?: number
  estimated_total_minutes?: number
  stops?: ApiPatrolStop[]
  [key: string]: unknown
}

export interface ApiPatrolStop {
  sequence?: number
  order?: number
  cluster_id?: string
  lat?: number
  centroid_lat?: number
  lng?: number
  centroid_lng?: number
  roi_score?: number
  peak_window?: string
  recommended_action?: string
  location_name?: string
  [key: string]: unknown
}

export interface PlanFileResponse {
  ok: boolean
  message?: string
  data: Record<string, unknown> | null
}

export interface ApiNotification {
  id: string
  filename: string
  recipient: string
  subject: string
  body: string
  kind: string
}

export interface AgentStateResponse {
  ok: boolean
  message?: string
  data: Record<string, unknown> | null
}

export interface InfraCandidateApi {
  cluster_id: string
  infra_dominant_cause?: string | null
  infra_suggested_fix?: string | null
  infra_escalation_ready?: number | null
  infra_structural_boost?: number | null
  [key: string]: unknown
}

export interface InfraPdfItem {
  filename: string
  size: number
  modified_at: string
  url: string
}

export interface ActionResponse {
  ok: boolean
  message: string
  data?: unknown
}
