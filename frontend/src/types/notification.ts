export type NotificationChannel = 'email' | 'sms' | 'push'
export type NotificationStatus = 'queued' | 'sent' | 'failed'

export interface NotificationPreview {
  id: string
  recipient: string
  recipient_role: 'officer' | 'tow_driver' | 'head_officer'
  subject: string
  station: string
  cluster_ids: string[]
  channel: NotificationChannel
  status: NotificationStatus
  scheduled_at: string
  body_preview: string
}
