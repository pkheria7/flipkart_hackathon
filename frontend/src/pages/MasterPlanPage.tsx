import { useQuery } from '@tanstack/react-query'
import { getDailyMasterPlan } from '@/services/masterPlanService'
import { ApprovalStatusStepper } from '@/components/workflow/ApprovalStatusStepper'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import type { PlanStatus } from '@/types/common'

export function MasterPlanPage() {
  const { data: planRes } = useQuery({
    queryKey: ['dailyMasterPlan'],
    queryFn: getDailyMasterPlan,
  })
  const plan = planRes?.data

  return (
    <PageScaffold
      eyebrow="Operations"
      title="Daily Master Plan Inbox"
      description="4 AM generated plan approval workflow coming in Phase 5"
    >
      <ApprovalStatusStepper status={(plan?.status as PlanStatus) ?? 'pending'} />
      <GlassCard className="mt-4">
        <p className="text-sm font-medium text-slate-700">
          {String(plan?.run_id ?? 'Loading...')} — {String(plan?.date ?? '')}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          {String(plan?.total_assignments ?? 0)} assignments across{' '}
          {Array.isArray(plan?.stations) ? plan.stations.length : 0} stations
        </p>
      </GlassCard>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Head officer review, revision, Kannada explanations, and dispatch trigger.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
