export type Classification = 'STRUCTURAL' | 'RESPONSIVE' | 'SEASONAL'

export type PlanStatus = 'pending' | 'approved' | 'revised' | 'dispatched'

export type WorkflowStatus =
  | 'STRUCTURAL'
  | 'RESPONSIVE'
  | 'SEASONAL'
  | 'PENDING'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECURRENCE'
  | 'CLEARED'

export type RoutingMode = 'OSM_GRAPH' | 'FALLBACK'

export interface ApiResponse<T> {
  data: T
  source: 'mock' | 'api'
  timestamp: string
}

export interface StationSummary {
  station: string
  assignment_count: number
  avg_roi_score: number
  structural_count: number
  responsive_count: number
}
