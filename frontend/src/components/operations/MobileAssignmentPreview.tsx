import { Clock, MapPin, Truck } from 'lucide-react'
import { MobileDeviceFrame } from '@/components/workflow/MobileDeviceFrame'
import { formatStation } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import type { PlanAssignment } from '@/lib/masterPlan'
import type { ApiNotification } from '@/types/api'

interface MobileAssignmentPreviewProps {
  assignment?: PlanAssignment | null
  notification?: ApiNotification | null
}

const CLS_STYLE: Record<string, string> = {
  STRUCTURAL: 'bg-red-100 text-red-700',
  RESPONSIVE: 'bg-blue-100 text-blue-700',
  SEASONAL: 'bg-amber-100 text-amber-700',
}

export function MobileAssignmentPreview({ assignment, notification }: MobileAssignmentPreviewProps) {
  const title = assignment?.tow_truck_id && !assignment?.officer_name ? 'Tow Mobile' : 'Officer Mobile'

  if (!assignment && !notification) {
    return (
      <MobileDeviceFrame title="Field Mobile">
        <p className="py-6 text-center text-xs text-civic-graphite">
          Run a dry-run dispatch to preview the field assignment card.
        </p>
      </MobileDeviceFrame>
    )
  }

  if (assignment) {
    const cls = (assignment.classification ?? '').toUpperCase()
    return (
      <MobileDeviceFrame title={title}>
        <div className="space-y-3">
          {/* header chip */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-btp-blue">
              Today's Assignment
            </p>
            {cls && (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', CLS_STYLE[cls] ?? 'bg-gray-100 text-gray-600')}>
                {cls}
              </span>
            )}
          </div>

          {/* cluster + station */}
          <div className="rounded-xl bg-btp-blue/10 px-3 py-2.5">
            <p className="text-xl font-bold text-civic-ink">{assignment.cluster_id}</p>
            <p className="mt-0.5 text-sm font-medium text-civic-graphite">{formatStation(assignment.station)}</p>
          </div>

          {/* time / officer / tow */}
          <div className="space-y-2">
            {assignment.time_window && (
              <p className="flex items-center gap-2 text-sm text-civic-ink">
                <Clock className="h-4 w-4 shrink-0 text-btp-signal" />
                {assignment.time_window}
              </p>
            )}
            {assignment.officer_name && (
              <p className="flex items-center gap-2 text-sm text-civic-ink">
                <MapPin className="h-4 w-4 shrink-0 text-btp-signal" />
                {assignment.officer_name}
              </p>
            )}
            {assignment.tow_truck_id && (
              <p className="flex items-center gap-2 text-sm text-civic-ink">
                <Truck className="h-4 w-4 shrink-0 text-status-route" />
                {assignment.tow_truck_id}
                {assignment.tow_driver ? ` · ${assignment.tow_driver}` : ''}
              </p>
            )}
          </div>

          {/* action */}
          {assignment.action && (
            <p className="rounded-lg bg-civic-mist/70 px-3 py-2 text-xs leading-relaxed text-civic-ink/80">
              {assignment.action}
            </p>
          )}

          {/* reason */}
          {assignment.reason && (
            <p className="text-[11px] leading-relaxed text-civic-graphite">
              {assignment.reason}
            </p>
          )}

          {/* roi */}
          {assignment.roi != null && (
            <div className="flex items-center justify-between border-t border-civic-ink/10 pt-2">
              <span className="text-xs text-civic-graphite">ROI Score</span>
              <span className="text-base font-bold text-btp-blue">{assignment.roi.toFixed(1)}</span>
            </div>
          )}
        </div>
      </MobileDeviceFrame>
    )
  }

  // notification-only fallback
  return (
    <MobileDeviceFrame title="Field Mobile">
      <div className="space-y-2">
        <p className="text-sm font-bold leading-snug text-civic-ink">{notification?.subject}</p>
        <p className="text-xs text-civic-graphite">{notification?.recipient}</p>
        <p className="max-h-44 overflow-y-auto whitespace-pre-line rounded-lg bg-civic-mist/70 px-3 py-2 text-xs leading-relaxed text-civic-ink/80 scrollbar-thin">
          {notification?.body?.slice(0, 500)}
        </p>
      </div>
    </MobileDeviceFrame>
  )
}
