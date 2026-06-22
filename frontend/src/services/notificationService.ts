import notificationsMock from '@/data/mock/notifications.sample.json'
import type { ApiNotification } from '@/types/api'
import { apiGet } from './apiClient'

const mockNotifications: ApiNotification[] = (notificationsMock as Array<{
  id: string
  recipient: string
  subject: string
  body_preview: string
  recipient_role: string
}>).map((n) => ({
  id: n.id,
  filename: `${n.id}.eml`,
  recipient: n.recipient,
  subject: n.subject,
  body: n.body_preview,
  kind: n.recipient_role === 'tow_driver' ? 'tow' : n.recipient_role,
}))

export async function getNotifications(limit = 200): Promise<ApiNotification[]> {
  return apiGet(`/api/notifications?limit=${limit}`, mockNotifications)
}
