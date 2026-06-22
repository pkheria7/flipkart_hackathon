import { useQuery } from '@tanstack/react-query'
import { getTopHotspots } from '@/services/hotspotService'
import { RoiComparisonChart } from '@/components/charts/RoiComparisonChart'
import { ClassificationDonut } from '@/components/charts/ClassificationDonut'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { WorkflowStatus } from '@/types/common'

export function PriorityBoardPage() {
  const { data: hotspots = [] } = useQuery({
    queryKey: ['topHotspots'],
    queryFn: () => getTopHotspots(5),
  })

  return (
    <PageScaffold
      eyebrow="Intelligence"
      title="Priority Board"
      description="ROI vs violation count board coming in Phase 3"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <RoiComparisonChart />
        <ClassificationDonut />
      </div>
      <GlassCard className="mt-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Top ROI Hotspots</p>
        <ul className="space-y-2">
          {hotspots.map((h) => (
            <li key={h.cluster_id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{h.cluster_id} — {h.assigned_station}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-btp-blue">{h.roi_score?.toFixed(1)}</span>
                {h.classification && (
                  <StatusBadge status={h.classification as WorkflowStatus} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </PageScaffold>
  )
}
