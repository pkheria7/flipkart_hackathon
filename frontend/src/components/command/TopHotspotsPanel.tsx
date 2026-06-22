import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import type { CommandHotspot } from '@/lib/hotspots'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { Classification } from '@/types/common'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface TopHotspotsPanelProps {
  hotspots: CommandHotspot[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  isLoading?: boolean
  className?: string
}

export function TopHotspotsPanel({
  hotspots,
  selectedId,
  onSelect,
  isLoading,
  className,
}: TopHotspotsPanelProps) {
  return (
    <div className={cn('flex min-h-0 flex-col rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 backdrop-blur-xl', className)}>
      <div className="shrink-0 border-b border-btp-cyan/10 px-4 py-3">
        <p className="text-sm font-bold text-civic-white">Top ROI Hotspots</p>
        <p className="text-[10px] uppercase tracking-wide text-civic-ivory/45">
          Impact per officer-hour ranking
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-civic-white/5" />
            ))}
          </div>
        ) : hotspots.length === 0 ? (
          <p className="p-4 text-center text-xs text-civic-ivory/50">No hotspots available.</p>
        ) : (
          <motion.ul variants={staggerContainer} initial="hidden" animate="visible" className="space-y-1">
            {hotspots.map((h, i) => {
              const active = h.cluster_id === selectedId
              return (
                <motion.li key={h.cluster_id} variants={fadeUp}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(h.cluster_id)}
                    className={cn(
                      'focus-ring-command w-full rounded-xl border px-3 py-2.5 text-left transition-all',
                      active
                        ? 'border-btp-cyan/40 bg-btp-blue/30 shadow-glow-cyan'
                        : 'border-transparent hover:border-btp-cyan/20 hover:bg-civic-white/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-civic-ivory/40">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-civic-white">
                            {getHotspotDisplayName(h)}
                          </span>
                          <span className="font-mono text-[9px] text-btp-cyan/50">{h.cluster_id}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-btp-cyan">
                        {h.roi.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 pl-7">
                      <span className="flex items-center gap-1.5 truncate text-[10px] text-civic-ivory/55">
                        <MapPin className="h-3 w-3 shrink-0 text-btp-cyan/60" />
                        <span className="truncate">{formatStation(h.station)}</span>
                        {h.peak_window && (
                          <>
                            <span className="text-civic-ivory/25">·</span>
                            <span className="shrink-0">{h.peak_window}</span>
                          </>
                        )}
                      </span>
                      {h.classification !== 'UNKNOWN' && (
                        <StatusBadge status={h.classification as Classification} className="shrink-0 !px-2 !py-0" />
                      )}
                    </div>
                    {(h.lcle != null || h.bci != null) && (
                      <div className="mt-1 pl-7 text-[9px] uppercase tracking-wide text-civic-ivory/35">
                        Road blocked {h.lcle != null ? `${h.lcle.toFixed(0)}%` : '—'} · Network {h.bci != null ? h.bci.toFixed(3) : '—'}
                      </div>
                    )}
                  </button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </div>
    </div>
  )
}
