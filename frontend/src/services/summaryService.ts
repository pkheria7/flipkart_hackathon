import type { HealthResponse, SummaryResponse } from '@/types/api'
import { apiGet } from './apiClient'
import { API_BASE_URL, USE_MOCK_DATA } from './config'

const mockSummary: SummaryResponse = {
  total_hotspots: 10,
  structural_count: 4,
  responsive_count: 5,
  seasonal_count: 1,
  average_roi: 72.4,
  average_lcle: 25.8,
  average_bci: 0.042,
  total_violations: 2192,
  total_assignments: 3,
  total_stations: 3,
  plan_status: 'pending',
  m10_wired: true,
  m15_wired: true,
  routing_mode: 'graph',
}

const mockHealth: HealthResponse = {
  ok: true,
  service: 'GridLock Command API (mock)',
  mode: 'mock',
  timestamp: new Date().toISOString(),
  key_files: {},
}

export async function getHealth(): Promise<HealthResponse> {
  if (USE_MOCK_DATA) {
    return mockHealth
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error('health check failed')
    return (await res.json()) as HealthResponse
  } catch {
    return { ...mockHealth, ok: false, mode: 'offline' }
  }
}

export async function getSummary(): Promise<SummaryResponse> {
  return apiGet('/api/summary', mockSummary)
}
