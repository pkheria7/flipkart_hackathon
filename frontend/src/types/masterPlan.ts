import type { PlanStatus } from './common'
import type { StationSummary } from './common'

export interface MasterPlanAssignment {
  cluster_id: string
  assigned_station: string
  time_window: string
  officer_id: string
  officer_name: string
  tow_truck_id?: string
  action: string
  reason: string
  explanation_en?: string
  explanation_kn?: string
  roi_score?: number
  lcle_pct?: number
  bci?: number
}

export interface MasterPlan {
  plan_id: string
  date: string
  generated_at: string
  status: PlanStatus
  station_summaries: StationSummary[]
  assignments: MasterPlanAssignment[]
}
