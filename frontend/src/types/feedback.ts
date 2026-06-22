export type OfficerAction = 'towed' | 'warned' | 'could_not_enforce'
export type FeedbackOutcome = 'resolved' | 'recurred' | 'no_violation'
export type ReasonCode =
  | 'no_parking_space'
  | 'loading'
  | 'broke_down'
  | 'ignored_sign'
  | 'customer_waiting'
  | 'other'

export interface OfficerFeedback {
  cluster_id: string
  officer_id: string
  action: OfficerAction
  outcome: FeedbackOutcome
  reason_code: ReasonCode
  reason_text?: string
  assigned_station: string
  timestamp: string
  source?: string
}

export interface CitizenFeedback {
  cluster_id: string
  reason_code: ReasonCode
  reason_text?: string
  timestamp: string
  source?: string
}

export interface FeedbackRecord {
  officer_feedback: OfficerFeedback[]
  citizen_feedback: CitizenFeedback[]
}

// ── Phase 6 cluster-scoped feedback API ──────────────────────────────────────

export interface FeedbackSummary {
  officer_event_count: number
  citizen_event_count: number
  recurred_after_enforcement_count: number
  feedback_structural_boost: number
}

/** Raw officer feedback row from the SQLite feedback_events table (loose shape). */
export interface OfficerFeedbackEvent {
  id?: number
  cluster_id?: string
  feedback_date?: string
  feedback_timestamp_ist?: string
  assigned_station?: string | null
  officer_id?: string | null
  action_type?: string
  enforcement_done?: number
  outcome?: string
  recurred_after_enforcement?: number
  recurrence_window_days?: number | null
  notes?: string | null
  source?: string
  created_at_ist?: string
  [key: string]: unknown
}

/** Raw citizen feedback row (loose shape). */
export interface CitizenFeedbackEvent {
  id?: number
  cluster_id?: string
  reason_code?: string
  reason_text?: string | null
  created_at?: string
  source?: string
  [key: string]: unknown
}

export interface FeedbackClusterResponse {
  ok: boolean
  cluster_id: string
  officer_feedback: OfficerFeedbackEvent[]
  citizen_feedback: CitizenFeedbackEvent[]
  summary: FeedbackSummary
}

export interface OfficerFeedbackPayload {
  cluster_id: string
  officer_id?: string
  action: OfficerAction
  outcome: FeedbackOutcome
  reason_code?: ReasonCode
  assigned_station?: string
  reason_text?: string
  source?: string
}

export interface CitizenFeedbackPayload {
  cluster_id: string
  reason_code: ReasonCode
  reason_text?: string
  source?: string
}
