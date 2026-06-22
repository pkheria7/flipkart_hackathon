import dailyPlanMock from '@/data/mock/daily_master_plan.sample.json'
import pendingPlanMock from '@/data/mock/pending_master_plan.sample.json'
import approvedPlanMock from '@/data/mock/approved_master_plan.sample.json'
import type { ActionResponse, PlanFileResponse } from '@/types/api'
import { apiGet, apiPost } from './apiClient'

const mockDaily: PlanFileResponse = { ok: true, data: dailyPlanMock as Record<string, unknown> }
const mockPending: PlanFileResponse = { ok: true, data: pendingPlanMock as Record<string, unknown> }
const mockApproved: PlanFileResponse = { ok: true, data: approvedPlanMock as Record<string, unknown> }

export async function getDailyMasterPlan(): Promise<PlanFileResponse> {
  return apiGet('/api/master-plan/daily', mockDaily)
}

export async function getPendingMasterPlan(): Promise<PlanFileResponse> {
  return apiGet('/api/master-plan/pending', mockPending)
}

export async function getApprovedMasterPlan(): Promise<PlanFileResponse> {
  return apiGet('/api/master-plan/approved', mockApproved)
}

export async function approveMasterPlan(): Promise<ActionResponse> {
  return apiPost('/api/master-plan/approve', undefined, {
    ok: true,
    message: 'Plan approved (mock)',
    data: approvedPlanMock,
  })
}

export async function dispatchApprovedPlan(): Promise<ActionResponse> {
  return apiPost('/api/dispatch/approved-plan', undefined, {
    ok: true,
    message: 'Dispatch dry-run complete (mock)',
    data: { eml_count: 3 },
  })
}
