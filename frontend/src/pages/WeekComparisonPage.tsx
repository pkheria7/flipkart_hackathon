import { useQuery } from '@tanstack/react-query'
import { getWeekComparison } from '@/services/reportService'
import { WeekComparisonChart } from '@/components/charts/WeekComparisonChart'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function WeekComparisonPage() {
  const { data: comparison } = useQuery({
    queryKey: ['weekComparison'],
    queryFn: getWeekComparison,
  })

  return (
    <PageScaffold
      eyebrow="Learning Loop"
      title="Week 1 vs Week 2 Dashboard"
      description="Synthetic closed-loop comparison coming in Phase 8"
    >
      <GlassCard className="border-violet-200 bg-violet-50/30">
        <p className="text-sm text-violet-800">{comparison?.disclaimer}</p>
      </GlassCard>
      <div className="mt-4">
        <WeekComparisonChart />
      </div>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Feedback-adjusted structural scoring vs baseline week — synthetic demo only.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
