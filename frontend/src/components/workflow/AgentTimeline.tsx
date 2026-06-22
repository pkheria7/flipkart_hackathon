import type { PipelineStep } from '@/types/agent'
import type { WorkflowStatus } from '@/types/common'
import { GlassCard } from '@/components/ui/GlassCard'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface AgentTimelineProps {
  steps: PipelineStep[]
}

function stepStatusBadge(status: PipelineStep['status']): WorkflowStatus {
  switch (status) {
    case 'completed':
      return 'APPROVED'
    case 'running':
      return 'DISPATCHED'
    case 'pending':
      return 'PENDING'
    case 'failed':
      return 'STRUCTURAL'
  }
}

export function AgentTimeline({ steps }: AgentTimelineProps) {
  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">Agent Pipeline</p>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.step} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{step.step.replace(/_/g, ' ')}</span>
            <StatusBadge status={stepStatusBadge(step.status)} />
          </li>
        ))}
      </ol>
    </GlassCard>
  )
}
