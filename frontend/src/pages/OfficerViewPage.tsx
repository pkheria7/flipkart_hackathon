import { useQuery } from '@tanstack/react-query'
import { getDailyMasterPlan } from '@/services/masterPlanService'
import { MobileDeviceFrame } from '@/components/workflow/MobileDeviceFrame'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { StatusBadge } from '@/components/ui/StatusBadge'

export function OfficerViewPage() {
  const { data: planRes } = useQuery({
    queryKey: ['dailyMasterPlan'],
    queryFn: getDailyMasterPlan,
  })

  const stations = planRes?.data?.stations as Array<{
    station: string
    assignments: Array<{
      cluster_id: string
      time_window: string
      action: string
    }>
  }> | undefined

  const assignment = stations?.[0]?.assignments?.[0]

  return (
    <PageScaffold
      eyebrow="Field"
      title="Officer Mobile View"
      description="Patrol assignment cards for field officers — Phase 6"
    >
      <MobileDeviceFrame title="BTP Patrol Assignments">
        {assignment ? (
          <div className="space-y-3">
            <StatusBadge status="DISPATCHED" />
            <p className="text-sm font-medium">{assignment.cluster_id}</p>
            <p className="text-xs text-slate-500">{assignment.time_window}</p>
            <p className="text-xs text-slate-600">{assignment.action}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading assignments...</p>
        )}
      </MobileDeviceFrame>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Mobile-optimized patrol cards with feedback capture buttons.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
