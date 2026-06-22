import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Crosshair, MousePointerClick } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { formatPeakViolationWindow } from '@/lib/timezone'
import type { CommandHotspot } from '@/lib/hotspots'
import type { Classification } from '@/types/common'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface SelectedHotspotCardProps {
  hotspot: CommandHotspot | null
  className?: string
}

export function SelectedHotspotCard({ hotspot, className }: SelectedHotspotCardProps) {
  if (!hotspot) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 px-4 py-6 text-center',
          className,
        )}
      >
        <MousePointerClick className="mb-2 h-6 w-6 text-btp-cyan/50" />
        <p className="text-sm font-semibold text-civic-white">No hotspot selected</p>
        <p className="mt-1 text-xs text-civic-ivory/50">
          Select a hotspot on the map or from the ROI stack.
        </p>
      </div>
    )
  }

  const stats: Array<{ label: string; sub: string; value: string }> = [
    { label: 'Priority', sub: 'ROI', value: hotspot.roi.toFixed(1) },
    { label: 'Road Blocked', sub: 'LCLE', value: hotspot.lcle != null ? `${hotspot.lcle.toFixed(1)}%` : '—' },
    { label: 'Network', sub: 'BCI', value: hotspot.bci != null ? hotspot.bci.toFixed(4) : '—' },
    { label: 'Violations', sub: 'FTVR', value: hotspot.violations.toLocaleString('en-IN') },
  ]

  return (
    <motion.div
      key={hotspot.cluster_id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className={cn('rounded-2xl border border-btp-cyan/20 bg-civic-navy/70 p-4 shadow-glow-cyan backdrop-blur-xl', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-btp-cyan">
            <Crosshair className="h-3 w-3" />
            Inspecting
          </p>
          <p className="mt-0.5 truncate text-lg font-bold text-civic-white">
            {getHotspotDisplayName(hotspot)}
          </p>
          <p className="truncate text-[10px] text-btp-cyan/60 font-mono">
            {hotspot.cluster_id}
          </p>
          <p className="truncate text-xs text-civic-ivory/55">
            {formatStation(hotspot.station)}
            {hotspot.peak_window
              ? ` · ${formatPeakViolationWindow(hotspot.peak_window, 'inline-subtitle')}`
              : ''}
          </p>
        </div>
        {hotspot.classification !== 'UNKNOWN' && (
          <StatusBadge status={hotspot.classification as Classification} className="shrink-0" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-civic-dusk/60 px-2 py-1.5 text-center">
            <p className="text-sm font-bold tabular-nums text-civic-white">{s.value}</p>
            <p className="text-[8px] font-semibold uppercase tracking-wide text-civic-ivory/45">{s.label}</p>
            <p className="text-[7px] text-civic-ivory/30">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-civic-ivory/55">
        <span>
          Road: <span className="text-civic-ivory/80">{hotspot.road_class ?? '—'}</span>
        </span>
        <span>
          Width: <span className="text-civic-ivory/80">{hotspot.road_width_m != null ? `${hotspot.road_width_m} m` : '—'}</span>
        </span>
        {hotspot.escalation_boost && (
          <span className="font-semibold text-status-structural">Escalation boost active</span>
        )}
      </div>

      {hotspot.recommended_action && (
        <p className="mt-3 rounded-lg border border-btp-cyan/15 bg-civic-dusk/60 px-3 py-2 text-xs leading-relaxed text-shell">
          {hotspot.recommended_action}
        </p>
      )}

      <Link to={`/hotspots/${hotspot.cluster_id}`} className="mt-3 block">
        <CommandButton variant="cyan" size="sm" className="w-full">
          Open full detail
          <ArrowUpRight className="h-4 w-4" />
        </CommandButton>
      </Link>
    </motion.div>
  )
}
