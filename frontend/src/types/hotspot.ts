import type { Classification } from './common'

export interface Hotspot {
  cluster_id: string
  centroid_lat: number
  centroid_lng: number
  assigned_station: string
  border_flag: boolean
  road_class: string
  road_width_m: number
  osm_coverage: number
  violation_count: number
  vehicle_mix: Record<string, number>
  lcle_pct: number
  bci: number
  persistence: number
  recurrence: number
  peak_window: string
  roi_score: number
  classification: Classification
  recommended_action: string
  feedback_structural_boost?: number
}

export interface HotspotSummary {
  total: number
  structural: number
  responsive: number
  seasonal: number
  avg_roi: number
}
