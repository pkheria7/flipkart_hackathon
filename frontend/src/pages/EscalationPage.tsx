import { useQuery } from '@tanstack/react-query'
import { getInfraEscalationCandidates } from '@/services/infraService'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { StatusBadge } from '@/components/ui/StatusBadge'

export function EscalationPage() {
  const { data: candidates = [] } = useQuery({
    queryKey: ['infra'],
    queryFn: getInfraEscalationCandidates,
  })

  const ready = candidates.filter((c) => c.infra_escalation_ready === 1)

  return (
    <PageScaffold
      eyebrow="Learning Loop"
      title="Infrastructure Escalation Center"
      description="Structural hotspot escalation to BBMP and allied agencies — Phase 7"
    >
      <GlassCard>
        <p className="text-sm text-slate-600">
          {ready.length} of {candidates.length} candidates escalation-ready
        </p>
      </GlassCard>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {candidates.slice(0, 10).map((c) => (
          <GlassCard key={c.cluster_id}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-800">{c.cluster_id}</p>
              <StatusBadge status={c.infra_escalation_ready === 1 ? 'STRUCTURAL' : 'PENDING'} />
            </div>
            <p className="mt-2 text-sm text-slate-500">{c.infra_dominant_cause}</p>
            <p className="mt-1 text-xs text-slate-400">{c.infra_suggested_fix}</p>
          </GlassCard>
        ))}
      </div>
    </PageScaffold>
  )
}
