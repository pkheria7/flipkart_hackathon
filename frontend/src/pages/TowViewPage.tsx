import { useQuery } from '@tanstack/react-query'
import { getDailyMasterPlan } from '@/services/masterPlanService'
import { MobileDeviceFrame } from '@/components/workflow/MobileDeviceFrame'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function TowViewPage() {
  const { data: planRes } = useQuery({
    queryKey: ['dailyMasterPlan'],
    queryFn: getDailyMasterPlan,
  })

  const stations = planRes?.data?.stations as Array<{
    assignments: Array<{
      cluster_id: string
      time_window: string
      tow_truck_id?: string | null
    }>
  }> | undefined

  const towAssignments =
    stations?.flatMap((s) => s.assignments.filter((a) => a.tow_truck_id)) ?? []

  return (
    <PageScaffold
      eyebrow="Field"
      title="Tow Truck View"
      description="Tow standby and towing task dispatch for drivers — Phase 6"
    >
      <MobileDeviceFrame title="BTP Tow Tasks">
        {towAssignments.length > 0 ? (
          <ul className="space-y-3">
            {towAssignments.slice(0, 5).map((a) => (
              <li key={a.cluster_id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">{a.tow_truck_id}</p>
                <p className="text-xs text-slate-500">{a.cluster_id} · {a.time_window}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No tow tasks assigned.</p>
        )}
      </MobileDeviceFrame>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Tow driver task list with location pins and ETA estimates.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
