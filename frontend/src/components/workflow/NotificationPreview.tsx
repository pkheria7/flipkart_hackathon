import type { NotificationPreview } from '@/types/notification'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface NotificationPreviewProps {
  notification: NotificationPreview
}

export function NotificationPreviewCard({
  notification,
}: NotificationPreviewProps) {
  const statusMap = {
    queued: 'PENDING' as const,
    sent: 'DISPATCHED' as const,
    failed: 'STRUCTURAL' as const,
  }

  return (
    <GlassCard className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{notification.subject}</p>
        <StatusBadge status={statusMap[notification.status]} />
      </div>
      <p className="text-xs text-slate-500">To: {notification.recipient}</p>
      <p className="text-xs text-slate-400 line-clamp-2">
        {notification.body_preview}
      </p>
    </GlassCard>
  )
}
