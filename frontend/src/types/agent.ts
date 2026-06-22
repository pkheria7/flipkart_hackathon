import type { PlanStatus } from './common'

export interface DispatchRecord {
  plan_id: string
  dispatched_at: string
  station_count: number
  assignment_count: number
}

export interface PipelineStep {
  step: string
  status: 'completed' | 'running' | 'pending' | 'failed'
  started_at?: string
  completed_at?: string
  message?: string
}

export interface RunSnapshot {
  run_id: string
  path: string
  created_at: string
}

export interface AgentState {
  last_run_timestamp: string
  plan_status: PlanStatus
  dispatch_history: DispatchRecord[]
  pipeline_steps: PipelineStep[]
  snapshots: RunSnapshot[]
}
