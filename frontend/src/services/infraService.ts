import infraMock from '@/data/mock/infra_summary.sample.json'
import type { InfraCandidateApi, InfraPdfItem } from '@/types/api'
import { apiGet } from './apiClient'

const mockCandidates: InfraCandidateApi[] = infraMock.candidates.map((c) => ({
  cluster_id: c.cluster_id,
  infra_dominant_cause: c.dominant_cause,
  infra_suggested_fix: c.suggested_fix,
  infra_escalation_ready: c.escalation_ready ? 1 : 0,
  infra_structural_boost: c.escalation_ready ? 1 : 0,
}))

const mockPdfs: InfraPdfItem[] = [
  {
    filename: 'escalation_brief_sample.pdf',
    size: 124_000,
    modified_at: new Date().toISOString(),
    url: '/api/infra/pdfs/escalation_brief_sample.pdf',
  },
]

export async function getInfraEscalationCandidates(): Promise<InfraCandidateApi[]> {
  return apiGet('/api/infra/escalation-candidates', mockCandidates)
}

export async function getInfraPdfs(): Promise<InfraPdfItem[]> {
  return apiGet('/api/infra/pdfs', mockPdfs)
}

export function getInfraPdfUrl(filename: string): string {
  return `/api/infra/pdfs/${encodeURIComponent(filename)}`
}
