import { Clock, MapPin, Truck } from 'lucide-react'
import { MobileDeviceFrame } from '@/components/workflow/MobileDeviceFrame'
import { formatStation } from '@/lib/formatters'
import type { PlanAssignment } from '@/lib/masterPlan'
import type { ApiNotification } from '@/types/api'

interface MobileAssignmentPreviewProps {
  assignment?: PlanAssignment | null
  notification?: ApiNotification | null
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
    return (
      <MobileDeviceFrame title={title}>
        <div className="space-y-3">
          <div className="rounded-xl bg-btp-blue/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-btp-blue">Today’s assignment</p>
            <p className="mt-1 text-base font-bold text-civic-ink">{assignment.cluster_id}</p>
            <p className="text-xs text-civic-graphite">{formatStation(assignment.station)}</p>
          </div>
          <div className="space-y-2 text-xs text-civic-ink">
            {assignment.time_window && (
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-btp-signal" />
                {assignment.time_window}
              </p>
            )}
            {assignment.officer_name && (
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-btp-signal" />
                {assignment.officer_name}
              </p>
            )}
            {assignment.tow_truck_id && (
              <p className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-status-route" />
                {assignment.tow_truck_id}
                {assignment.tow_driver ? ` · ${assignment.tow_driver}` : ''}
              </p>
            )}
          </div>
          {assignment.action && (
            <p className="rounded-lg bg-civic-mist/70 p-2.5 text-[11px] leading-relaxed text-civic-ink/80">
              {assignment.action}
            </p>
          )}
          {assignment.roi != null && (
            <p className="text-right text-[11px] font-bold text-btp-blue">ROI {assignment.roi.toFixed(1)}</p>
          )}
        </div>
      </MobileDeviceFrame>
    )
  }

  return (
    <MobileDeviceFrame title="Field Mobile">
      <div className="space-y-2">
        <p className="text-sm font-bold text-civic-ink">{notification?.subject}</p>
        <p className="text-[11px] text-civic-graphite">{notification?.recipient}</p>
        <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-lg bg-civic-mist/70 p-2.5 text-[11px] leading-relaxed text-civic-ink/80 scrollbar-thin">
          {notification?.body?.slice(0, 400)}
        </p>
      </div>
    </MobileDeviceFrame>
  )
}
