export interface InfraEscalationCandidate {
  cluster_id: string
  assigned_station: string
  dominant_cause: string
  suggested_fix: string
  recommended_agency: string
  lcle_pct: number
  bci: number
  roi_score: number
  escalation_ready: boolean
}

export interface InfraSummary {
  total_candidates: number
  escalation_ready_count: number
  top_causes: Array<{ cause: string; count: number }>
  candidates: InfraEscalationCandidate[]
}
