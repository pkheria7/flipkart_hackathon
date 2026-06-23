import { MobileDeviceFrame } from '@/components/workflow/MobileDeviceFrame'
import { KIND_META } from './NotificationCard'
import type { ApiNotification } from '@/types/api'

interface MobileAssignmentPreviewProps {
  notification?: ApiNotification | null
}

const KIND_TITLE: Record<string, string> = {
  head_officer: 'Head Officer App',
  officer: 'Officer App',
  tow: 'Tow Truck App',
  unknown: 'Field Mobile',
}

export function MobileAssignmentPreview({ notification }: MobileAssignmentPreviewProps) {
  if (!notification) {
    return (
      <MobileDeviceFrame title="Field Mobile">
        <p className="py-6 text-center text-xs text-civic-graphite">
          Select a notification to preview it on the field device.
        </p>
      </MobileDeviceFrame>
    )
  }

  const title = KIND_TITLE[notification.kind] ?? 'Field Mobile'
  const meta = KIND_META[notification.kind] ?? KIND_META.unknown
  const Icon = meta.icon

  return (
    <MobileDeviceFrame title={title}>
      <div className="space-y-3">
        {/* type badge */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${meta.chip}`}>
            <Icon className="h-2.5 w-2.5" />
            {meta.label}
          </span>
        </div>

        {/* recipient */}
        <div className="rounded-lg bg-btp-blue/5 px-2.5 py-1.5 text-xs">
          <span className="text-civic-graphite">To: </span>
          <span className="font-semibold text-civic-ink">{notification.recipient || '—'}</span>
        </div>

        {/* subject */}
        <p className="text-sm font-bold leading-snug text-civic-ink">
          {notification.subject || '(no subject)'}
        </p>

        {/* body */}
        <div className="max-h-52 overflow-y-auto rounded-lg bg-civic-mist/70 px-2.5 py-2 scrollbar-thin">
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-civic-ink/80">
            {notification.body || 'No content.'}
          </pre>
        </div>
      </div>
    </MobileDeviceFrame>
  )
}
