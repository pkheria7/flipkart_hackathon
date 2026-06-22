import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeftRight, Hash, Lightbulb, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { classificationColor, type CommandHotspot } from '@/lib/hotspots'
import { staggerContainer } from '@/lib/motion'
import { HotspotRankCard } from './HotspotRankCard'
import { IntelligenceInsightCard } from './IntelligenceInsightCard'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface RoiCountComparisonProps {
  hotspots: CommandHotspot[]
  selectedId?: string | null
  onSelect: (id: string) => void
}

interface DivergenceItem {
  hotspot: CommandHotspot
  roiRank: number
  violRank: number
  gap: number
}

export function RoiCountComparison({ hotspots, selectedId, onSelect }: RoiCountComparisonProps) {
  const { topByRoi, topByViol, underrated, overrated, chartData } = useMemo(() => {
    const byRoi = [...hotspots].sort((a, b) => b.roi - a.roi)
    const byViol = [...hotspots].sort((a, b) => b.violations - a.violations)

    const roiRank = new Map<string, number>()
    byRoi.forEach((h, i) => roiRank.set(h.cluster_id, i + 1))
    const violRank = new Map<string, number>()
    byViol.forEach((h, i) => violRank.set(h.cluster_id, i + 1))

    const diff: DivergenceItem[] = hotspots.map((h) => {
      const r = roiRank.get(h.cluster_id) ?? 9999
      const v = violRank.get(h.cluster_id) ?? 9999
      return { hotspot: h, roiRank: r, violRank: v, gap: v - r }
    })

    // High impact, lower challan volume — "patrol these even though count is lower".
    const under = diff
      .filter((d) => d.roiRank <= 15 && d.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3)

    // High challan volume, lower traffic impact — "don't over-patrol by count alone".
    const over = diff
      .filter((d) => d.violRank <= 15 && d.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3)

    const maxViol = Math.max(1, ...byRoi.slice(0, 10).map((h) => h.violations))
    const chart = byRoi.slice(0, 10).map((h) => ({
      id: h.cluster_id.replace('C_', ''),
      roi: Number(h.roi.toFixed(1)),
      violScaled: Number(((h.violations / maxViol) * 100).toFixed(1)),
      violations: h.violations,
      color: classificationColor(h.classification),
    }))

    return {
      topByRoi: byRoi.slice(0, 10),
      topByViol: byViol.slice(0, 10),
      underrated: under,
      overrated: over,
      chartData: chart,
    }
  }, [hotspots])

  return (
    <div className="space-y-4">
      <IntelligenceInsightCard icon={Lightbulb} title="Why Enforcement Priority ≠ raw challan count" tone="cyan">
        High challan volume does not always mean highest traffic damage. Enforcement Priority (ROI) combines{' '}
        <span className="font-semibold text-btp-cyan">road blockage (LCLE)</span>,{' '}
        <span className="font-semibold text-btp-cyan">network importance (BCI)</span>, repeat pressure, recurrence, and
        operational cost to prioritize <span className="font-semibold text-civic-white">impact per officer-hour</span>.
      </IntelligenceInsightCard>

      {/* side-by-side ranked lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankColumn
          title="Top by violation count"
          subtitle="Raw challan volume"
          icon={Hash}
          tone="amber"
          hotspots={topByViol}
          metric="violations"
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <RankColumn
          title="Top by Enforcement Priority"
          subtitle="Traffic impact per officer-hour (ROI)"
          icon={TrendingUp}
          tone="cyan"
          hotspots={topByRoi}
          metric="roi"
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>

      {/* divergence insight */}
      <div className="relative overflow-hidden rounded-2xl border border-status-structural/25 bg-civic-navy/55 p-4 shadow-glow-red backdrop-blur-xl">
        <div className="aurora-orb -right-10 -top-10 h-40 w-40 opacity-30" style={{ background: 'radial-gradient(circle, rgba(214,40,40,0.25) 0%, transparent 70%)' }} />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-bold text-civic-white">
            <ArrowLeftRight className="h-4 w-4 text-status-structural" />
            Divergence insight
          </p>
          <p className="mt-1 text-xs text-civic-ivory/65">
            Where ROI ranking and challan-count ranking disagree — this is why BTP should not patrol
            only by challan count.
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DivergenceList
              label="High impact · lower challan count"
              hint="Patrol these even though raw count is lower"
              items={underrated}
              accent="text-btp-cyan"
              onSelect={onSelect}
              selectedId={selectedId}
            />
            <DivergenceList
              label="High challan count · lower impact"
              hint="Don't over-commit officer-hours by count alone"
              items={overrated}
              accent="text-status-amber"
              onSelect={onSelect}
              selectedId={selectedId}
            />
          </div>
        </div>
      </div>

      {/* chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 backdrop-blur-xl">
          <p className="text-sm font-bold text-civic-white">ROI vs violation count — top 10 by ROI</p>
          <p className="mb-3 text-[11px] text-civic-ivory/50">
            Violation count normalized to 0–100 for shape comparison. Bars colored by classification.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(247,242,232,0.08)" vertical={false} />
              <XAxis dataKey="id" tick={{ fill: 'rgba(247,242,232,0.55)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(247,242,232,0.45)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(6,17,31,0.92)',
                  border: '1px solid rgba(34,211,238,0.3)',
                  borderRadius: 10,
                  color: '#F7F2E8',
                  fontSize: 12,
                }}
                formatter={(value, name, item) => {
                  if (name === 'violScaled') {
                    const payload = item?.payload as { violations?: number } | undefined
                    return [payload?.violations ?? value, 'Violations']
                  }
                  return [value, 'Priority']
                }}
              />
              <Legend
                formatter={(v) => (v === 'roi' ? 'Enforcement Priority (ROI)' : 'Violations (scaled)')}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="roi" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {chartData.map((d) => (
                  <Cell key={d.id} fill={d.color} />
                ))}
              </Bar>
              <Bar dataKey="violScaled" radius={[3, 3, 0, 0]} maxBarSize={26} fill="#F59E0B" fillOpacity={0.55} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function RankColumn({
  title,
  subtitle,
  icon: Icon,
  tone,
  hotspots,
  metric,
  selectedId,
  onSelect,
}: {
  title: string
  subtitle: string
  icon: typeof Hash
  tone: 'cyan' | 'amber'
  hotspots: CommandHotspot[]
  metric: 'roi' | 'violations'
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/45 p-3 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            tone === 'cyan' ? 'bg-btp-cyan/15 text-btp-cyan' : 'bg-status-amber/15 text-status-amber',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-civic-white">{title}</p>
          <p className="text-[10px] uppercase tracking-wide text-civic-ivory/45">{subtitle}</p>
        </div>
      </div>
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-1.5">
        {hotspots.map((h, i) => (
          <HotspotRankCard
            key={h.cluster_id}
            rank={i + 1}
            hotspot={h}
            metric={metric}
            selected={h.cluster_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </motion.div>
    </div>
  )
}

function DivergenceList({
  label,
  hint,
  items,
  accent,
  onSelect,
  selectedId,
}: {
  label: string
  hint: string
  items: DivergenceItem[]
  accent: string
  onSelect: (id: string) => void
  selectedId?: string | null
}) {
  return (
    <div className="rounded-xl border border-btp-cyan/10 bg-civic-dusk/50 p-3">
      <p className={cn('text-xs font-bold', accent)}>{label}</p>
      <p className="mb-2 text-[10px] text-civic-ivory/45">{hint}</p>
      {items.length === 0 ? (
        <p className="py-2 text-[11px] text-civic-ivory/40">No clear divergence in current filter.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((d) => (
            <li key={d.hotspot.cluster_id}>
              <button
                type="button"
                onClick={() => onSelect(d.hotspot.cluster_id)}
                className={cn(
                  'focus-ring-command flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                  d.hotspot.cluster_id === selectedId
                    ? 'border-btp-cyan/40 bg-btp-blue/25'
                    : 'border-transparent hover:bg-civic-white/5',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-civic-white">
                    {getHotspotDisplayName(d.hotspot)}
                  </span>
                  <span className="font-mono text-[9px] text-btp-cyan/50">{d.hotspot.cluster_id}</span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-civic-ivory/55">
                  ROI #{d.roiRank} · Count #{d.violRank}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
