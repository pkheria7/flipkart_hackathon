import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  Gauge,
  Map as MapIcon,
  MousePointerClick,
  Network,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { formatPeakViolationWindow } from '@/lib/timezone'
import type { CommandHotspot } from '@/lib/hotspots'
import type { Classification } from '@/types/common'
import { IntelligenceInsightCard } from './IntelligenceInsightCard'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface HotspotInspectorProps {
  hotspot: CommandHotspot | null
}

export function HotspotInspector({ hotspot }: HotspotInspectorProps) {
  const [added, setAdded] = useState(false)

  if (!hotspot) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 px-6 py-16 text-center">
        <MousePointerClick className="mb-3 h-8 w-8 text-btp-cyan/50" />
        <p className="text-base font-semibold text-civic-white">No hotspot selected</p>
        <p className="mt-1 max-w-sm text-sm text-civic-ivory/55">
          Select a hotspot from the priority board to inspect enforcement priority, road blockage, and recommended action.
        </p>
      </div>
    )
  }

  const peakWindowValue = formatPeakViolationWindow(hotspot.peak_window, 'labeled') ?? '—'
  const stats: Array<{ label: string; sub?: string; value: string; wide?: boolean }> = [
    { label: 'Enforcement Priority', sub: 'ROI score', value: hotspot.roi.toFixed(1) },
    { label: 'Road Space Blocked', sub: 'LCLE %', value: hotspot.lcle != null ? `${hotspot.lcle.toFixed(1)}%` : '—' },
    { label: 'Network Importance', sub: 'BCI', value: hotspot.bci != null ? hotspot.bci.toFixed(4) : '—' },
    { label: 'Violation Count', value: hotspot.violations.toLocaleString('en-IN') },
    { label: 'Repeat Pressure', sub: 'Persistence', value: hotspot.persistence != null ? hotspot.persistence.toFixed(1) : '—' },
    { label: 'Recurrence Rate', sub: 'Recurrence', value: hotspot.recurrence != null ? hotspot.recurrence.toFixed(3) : '—' },
    { label: 'Road class', value: hotspot.road_class ?? '—' },
    { label: 'Road width', value: hotspot.road_width_m != null ? `${hotspot.road_width_m} m` : '—' },
    { label: 'OSM coverage', value: hotspot.osm_coverage != null ? `${(hotspot.osm_coverage * 100).toFixed(0)}%` : '—' },
    { label: 'Peak Violation Window', sub: 'Peak window (IST)', value: peakWindowValue, wide: true },
  ]

  return (
    <motion.div
      key={hotspot.cluster_id}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="grid gap-4 lg:grid-cols-3"
    >
      {/* left: identity + stats + actions */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl border border-btp-cyan/20 bg-civic-navy/65 p-5 shadow-glow-cyan backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-btp-cyan">Inspecting hotspot</p>
              <h3 className="mt-0.5 text-2xl font-bold text-civic-white">
                {getHotspotDisplayName(hotspot)}
              </h3>
              <p className="font-mono text-[10px] text-btp-cyan/55">{hotspot.cluster_id}</p>
              <p className="text-sm text-civic-ivory/60">
                {formatStation(hotspot.station)}
                {hotspot.peak_window
                  ? ` · ${formatPeakViolationWindow(hotspot.peak_window, 'inline-subtitle')}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hotspot.classification !== 'UNKNOWN' && (
                <StatusBadge status={hotspot.classification as Classification} />
              )}
              {hotspot.escalation_boost && (
                <span className="rounded-full border border-status-structural/30 bg-status-structural/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-status-structural">
                  Escalation boost
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <div
                key={s.label}
                className={cn(
                  'rounded-lg bg-civic-dusk/60 px-2.5 py-2',
                  s.wide && 'col-span-2 sm:col-span-3 lg:col-span-5',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-bold capitalize tabular-nums text-civic-white',
                    s.wide ? 'whitespace-nowrap text-xs sm:text-sm' : 'truncate',
                  )}
                >
                  {s.value}
                </p>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-civic-ivory/45">{s.label}</p>
                {s.sub && <p className="text-[7px] text-civic-ivory/30">{s.sub}</p>}
              </div>
            ))}
          </div>

          {hotspot.vehicle_mix && Object.keys(hotspot.vehicle_mix).length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-civic-ivory/45">Vehicle mix</p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-civic-dusk/60">
                {Object.entries(hotspot.vehicle_mix).map(([k, v], i) => (
                  <span
                    key={k}
                    title={`${k}: ${(v * 100).toFixed(0)}%`}
                    className={cn(
                      i === 0 ? 'bg-btp-cyan' : i === 1 ? 'bg-btp-signal' : 'bg-status-seasonal',
                    )}
                    style={{ width: `${v * 100}%` }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-civic-ivory/55">
                {Object.entries(hotspot.vehicle_mix).map(([k, v]) => (
                  <span key={k}>
                    {k.replace(/_/g, ' ')} {(v * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {hotspot.recommended_action && (
            <div className="mt-4 rounded-xl border border-btp-cyan/15 bg-civic-dusk/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Recommended action</p>
              <p className="mt-1 text-sm leading-relaxed text-shell">{hotspot.recommended_action}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/hotspots/${hotspot.cluster_id}`}>
              <CommandButton variant="cyan" size="sm">
                Open full detail
                <ArrowUpRight className="h-4 w-4" />
              </CommandButton>
            </Link>
            <Link to="/command">
              <CommandButton variant="secondary" size="sm">
                <MapIcon className="h-4 w-4" />
                View on map
              </CommandButton>
            </Link>
            <CommandButton
              variant={added ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => setAdded((v) => !v)}
            >
              {added ? <Check className="h-4 w-4 text-status-cleared" /> : <Plus className="h-4 w-4" />}
              {added ? 'Added to patrol review' : 'Add to patrol review'}
            </CommandButton>
          </div>
        </div>
      </div>

      {/* right: metric explainers */}
      <div className="space-y-3">
        <IntelligenceInsightCard icon={Gauge} title="Road Space Blocked" tone="cyan">
          <span className="font-semibold text-btp-cyan">LCLE</span> — Lane Clearance Loss Estimate. Estimates usable road capacity blocked by parking pressure.
        </IntelligenceInsightCard>
        <IntelligenceInsightCard icon={Network} title="Network Importance" tone="seasonal">
          <span className="font-semibold text-status-seasonal">BCI</span> — Betweenness Centrality Index. Higher values mean disruptions here affect more routes.
        </IntelligenceInsightCard>
        <IntelligenceInsightCard icon={TrendingUp} title="Enforcement Priority" tone="amber">
          <span className="font-semibold text-status-amber">ROI score</span> — Impact per officer-hour. Prioritises where enforcement gives the strongest traffic benefit.
        </IntelligenceInsightCard>
      </div>
    </motion.div>
  )
}
