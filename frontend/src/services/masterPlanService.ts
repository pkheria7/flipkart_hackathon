import dailyPlanMock from '@/data/mock/daily_master_plan.sample.json'
import pendingPlanMock from '@/data/mock/pending_master_plan.sample.json'
import approvedPlanMock from '@/data/mock/approved_master_plan.sample.json'
import type { ActionResponse, PlanFileResponse } from '@/types/api'
import { apiGet, apiPost } from './apiClient'

const mockDaily: PlanFileResponse = { ok: true, data: dailyPlanMock as Record<string, unknown> }
const mockPending: PlanFileResponse = { ok: true, data: pendingPlanMock as Record<string, unknown> }
const mockApproved: PlanFileResponse = { ok: true, data: approvedPlanMock as Record<string, unknown> }

export async function getDailyMasterPlan(): Promise<PlanFileResponse> {
  const res = await apiGet('/api/master-plan/daily', mockDaily)
  if (import.meta.env.DEV) console.log('[masterPlanService] daily plan loaded, ok=', res.ok)
  return res
}

export async function getPendingMasterPlan(): Promise<PlanFileResponse> {
  const res = await apiGet('/api/master-plan/pending', mockPending)
  if (import.meta.env.DEV) console.log('[masterPlanService] pending plan loaded, ok=', res.ok)
  return res
}

export async function getApprovedMasterPlan(): Promise<PlanFileResponse> {
  const res = await apiGet('/api/master-plan/approved', mockApproved)
  if (import.meta.env.DEV) console.log('[masterPlanService] approved plan loaded, ok=', res.ok)
  return res
}

export async function approveMasterPlan(): Promise<ActionResponse> {
  const res = await apiPost<ActionResponse>('/api/master-plan/approve', undefined, {
    ok: true,
    message: 'Plan approved (mock)',
    data: approvedPlanMock,
  })
  if (import.meta.env.DEV) console.log('[masterPlanService] approve result:', res)
  return res
}

export async function dispatchApprovedPlan(): Promise<ActionResponse> {
  const res = await apiPost<ActionResponse>('/api/dispatch/approved-plan', undefined, {
    ok: true,
    message: 'Dispatch dry-run complete (mock)',
    data: { eml_count: 3 },
  })
  if (import.meta.env.DEV) console.log('[masterPlanService] dispatch result:', res)
  return res
}
