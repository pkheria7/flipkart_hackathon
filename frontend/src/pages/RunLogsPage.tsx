import { useQuery } from '@tanstack/react-query'
import { getAgentState } from '@/services/agentService'
import { AgentTimeline } from '@/components/workflow/AgentTimeline'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { formatTimestamp } from '@/lib/formatters'
import type { PipelineStep } from '@/types/agent'

const defaultSteps: PipelineStep[] = [
  { step: 'score_hotspots', status: 'completed' },
  { step: 'generate_routes', status: 'completed' },
  { step: 'generate_master_plan', status: 'completed' },
]

export function RunLogsPage() {
  const { data: stateRes } = useQuery({
    queryKey: ['agentState'],
    queryFn: getAgentState,
  })
  const state = stateRes?.data

  return (
    <PageScaffold
      eyebrow="System"
      title="Agent Run Logs"
      description="Pipeline execution history and run snapshots — Phase 5"
    >
      <GlassCard>
        <p className="text-sm text-slate-600">
          Last run: {state?.last_run_timestamp ? formatTimestamp(String(state.last_run_timestamp)) : '—'} ·
          Status: {String(state?.last_plan_status ?? '—')}
        </p>
      </GlassCard>
      <div className="mt-4">
        <AgentTimeline steps={defaultSteps} />
      </div>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Run snapshots, dispatch audit, and pipeline step diagnostics.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
