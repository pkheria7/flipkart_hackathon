import agentStateMock from '@/data/mock/agent_state.sample.json'
import type { AgentStateResponse } from '@/types/api'
import { apiGet } from './apiClient'

const mockAgent: AgentStateResponse = {
  ok: true,
  data: {
    last_run_id: '20260621_201243',
    last_run_timestamp: agentStateMock.last_run_timestamp,
    last_plan_status: agentStateMock.plan_status,
    last_dispatched_at: agentStateMock.dispatch_history[0]?.dispatched_at,
    total_runs: 1,
  },
}

export async function getAgentState(): Promise<AgentStateResponse> {
  return apiGet('/api/agent/state', mockAgent)
}
