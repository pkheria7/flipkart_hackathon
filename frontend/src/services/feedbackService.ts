import feedbackMock from '@/data/mock/feedback.sample.json'
import type {
  CitizenFeedbackPayload,
  FeedbackClusterResponse,
  FeedbackRecord,
  OfficerFeedbackPayload,
} from '@/types/feedback'
import type { ActionResponse } from '@/types/api'
import { API_BASE_URL, USE_MOCK_DATA } from './config'
import { apiGet, apiPost } from './apiClient'
import { mockDelay } from '@/lib/mockDelay'

/** Legacy whole-DB feedback fetch (kept for the legacy /feedback page). */
export async function getFeedback(): Promise<FeedbackRecord> {
  if (USE_MOCK_DATA) {
    await mockDelay()
    return feedbackMock as FeedbackRecord
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/feedback`)
    if (!response.ok) throw new Error('Feedback fetch failed')
    return (await response.json()) as FeedbackRecord
  } catch {
    await mockDelay()
    return feedbackMock as FeedbackRecord
  }
}

function emptyClusterFeedback(clusterId: string): FeedbackClusterResponse {
  return {
    ok: true,
    cluster_id: clusterId,
    officer_feedback: [],
    citizen_feedback: [],
    summary: {
      officer_event_count: 0,
      citizen_event_count: 0,
      recurred_after_enforcement_count: 0,
      feedback_structural_boost: 0,
    },
  }
}

/** Cluster-scoped feedback events + summary (Phase 6). */
export async function getFeedbackForCluster(clusterId: string): Promise<FeedbackClusterResponse> {
  return apiGet(
    `/api/feedback/${encodeURIComponent(clusterId)}`,
    emptyClusterFeedback(clusterId),
  )
}

export async function submitOfficerFeedback(
  payload: OfficerFeedbackPayload,
): Promise<ActionResponse> {
  return apiPost(
    '/api/feedback/officer',
    { source: 'frontend_demo', ...payload },
    { ok: true, message: 'Officer feedback recorded (mock)' },
  )
}

export async function submitCitizenFeedback(
  payload: CitizenFeedbackPayload,
): Promise<ActionResponse> {
  return apiPost(
    '/api/feedback/citizen',
    { source: 'frontend_demo', ...payload },
    { ok: true, message: 'Citizen feedback recorded (mock)' },
  )
}
