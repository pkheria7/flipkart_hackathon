import reportsMock from '@/data/mock/reports.sample.json'
import weekComparisonMock from '@/data/mock/week_comparison.sample.json'
import type { ReportItem, WeekComparison } from '@/types/report'
import { fetchWithMockFallback } from './apiClient'

export async function getReports(): Promise<ReportItem[]> {
  return fetchWithMockFallback('/api/reports', reportsMock as ReportItem[])
}

export async function getWeekComparison(): Promise<WeekComparison> {
  return fetchWithMockFallback(
    '/api/reports/week-comparison',
    weekComparisonMock as WeekComparison,
  )
}
