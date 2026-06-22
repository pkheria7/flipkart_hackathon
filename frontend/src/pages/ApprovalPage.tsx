import { useQuery } from '@tanstack/react-query'
import { getPendingMasterPlan } from '@/services/masterPlanService'
import { ApprovalStatusStepper } from '@/components/workflow/ApprovalStatusStepper'
import { CommandButton } from '@/components/ui/CommandButton'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import type { PlanStatus } from '@/types/common'

export function ApprovalPage() {
  const { data: planRes } = useQuery({
    queryKey: ['pendingMasterPlan'],
    queryFn: getPendingMasterPlan,
  })
  const plan = planRes?.data

  return (
    <PageScaffold
      eyebrow="Operations"
      title="Plan Approval / Revision"
      description="Human-in-the-loop approval before officer and tow dispatch"
      actions={
        <>
          <CommandButton variant="secondary" className="mr-2">Request Revision</CommandButton>
          <CommandButton>Approve Plan</CommandButton>
        </>
      }
    >
      <ApprovalStatusStepper status={(plan?.status as PlanStatus) ?? 'pending'} />
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-600">
          Pending plan with {String(plan?.total_assignments ?? 0)} assignments awaiting sign-off.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
