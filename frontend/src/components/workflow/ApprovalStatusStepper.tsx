import type { PlanStatus } from '@/types/common'
import { cn } from '@/lib/cn'
import { GlassCard } from '@/components/ui/GlassCard'

interface ApprovalStatusStepperProps {
  status: PlanStatus
}

const steps: { key: PlanStatus; label: string }[] = [
  { key: 'pending', label: 'Generated' },
  { key: 'approved', label: 'Approved' },
  { key: 'revised', label: 'Revised' },
  { key: 'dispatched', label: 'Dispatched' },
]

const statusOrder: PlanStatus[] = ['pending', 'approved', 'revised', 'dispatched']

export function ApprovalStatusStepper({ status }: ApprovalStatusStepperProps) {
  const currentIndex = statusOrder.indexOf(status)

  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">Approval Workflow</p>
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const isActive = i <= currentIndex
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  isActive
                    ? 'bg-btp-blue text-civic-white'
                    : 'bg-civic-mist text-civic-graphite',
                )}
              >
                {i + 1}
              </div>
              <span className="mt-1 text-[10px] text-slate-500">{step.label}</span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
