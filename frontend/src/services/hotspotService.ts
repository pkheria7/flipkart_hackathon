import hotspotsMock from '@/data/mock/hotspots.sample.json'
import type { ApiHotspot, HotspotSummaryResponse } from '@/types/api'
import type { Hotspot } from '@/types/hotspot'
import { apiGet } from './apiClient'

export interface HotspotQueryParams {
  station?: string
  classification?: string
  sort_by?: string
  limit?: number
}

const mockHotspots = hotspotsMock as Hotspot[]

const mockHotspotSummary: HotspotSummaryResponse = {
  ok: true,
  total_hotspots: mockHotspots.length,
  classification_counts: {
    STRUCTURAL: mockHotspots.filter((h) => h.classification === 'STRUCTURAL').length,
    RESPONSIVE: mockHotspots.filter((h) => h.classification === 'RESPONSIVE').length,
    SEASONAL: mockHotspots.filter((h) => h.classification === 'SEASONAL').length,
  },
  average_roi_score: 72.4,
  average_lcle: 25.8,
  average_bci: 0.042,
  total_violations: mockHotspots.reduce((s, h) => s + h.violation_count, 0),
  stations: new Set(mockHotspots.map((h) => h.assigned_station)).size,
}

function toQuery(params?: HotspotQueryParams): string {
  if (!params) return ''
  const q = new URLSearchParams()
  if (params.station) q.set('station', params.station)
  if (params.classification) q.set('classification', params.classification)
  if (params.sort_by) q.set('sort_by', params.sort_by)
  if (params.limit != null) q.set('limit', String(params.limit))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function getHotspots(params?: HotspotQueryParams): Promise<ApiHotspot[]> {
  return apiGet(`/api/hotspots${toQuery(params)}`, mockHotspots as unknown as ApiHotspot[])
}

export async function getTopHotspots(limit = 10): Promise<ApiHotspot[]> {
  return getHotspots({ sort_by: 'roi_score', limit })
}

export async function getHotspotSummary(): Promise<HotspotSummaryResponse> {
  return apiGet('/api/hotspots/summary', mockHotspotSummary)
}

export async function getHotspotById(clusterId: string): Promise<ApiHotspot | null> {
  const fallback = mockHotspots.find((h) => h.cluster_id === clusterId) ?? null
  const result = await apiGet<ApiHotspot | null>(
    `/api/hotspots/${encodeURIComponent(clusterId)}`,
    fallback as ApiHotspot | null,
  )
  return result
}
