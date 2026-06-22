import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Target } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { CommandHotspot } from '@/lib/hotspots'
import type { Classification } from '@/types/common'

interface FeedbackHotspotSelectorProps {
  hotspots: CommandHotspot[]
  value: string
  onChange: (clusterId: string) => void
  isLoading?: boolean
  /** Cap on candidates surfaced in the picker. */
  pool?: number
}

export function FeedbackHotspotSelector({
  hotspots,
  value,
  onChange,
  isLoading,
  pool = 250,
}: FeedbackHotspotSelectorProps) {
  const [query, setQuery] = useState('')

  const candidates = useMemo(() => hotspots.slice(0, pool), [hotspots, pool])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? candidates.filter(
          (h) =>
            h.cluster_id.toLowerCase().includes(q) ||
            h.station.toLowerCase().includes(q) ||
            h.classification.toLowerCase().includes(q),
        )
      : candidates
    return base.slice(0, 100)
  }, [candidates, query])

  if (isLoading) return <LoadingSkeleton lines={5} />

  return (
    <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-btp-cyan">
          <Target className="h-3.5 w-3.5" />
          Select hotspot
        </p>
        <span className="text-[10px] text-civic-ivory/45">{candidates.length} candidates</span>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-civic-ivory/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cluster ID, station, or class…"
          aria-label="Search hotspots"
          className="focus-ring-command w-full rounded-xl border border-btp-cyan/15 bg-civic-dusk/70 py-2.5 pl-9 pr-3 text-sm text-civic-white placeholder:text-civic-ivory/35"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-btp-cyan/20 p-4 text-center text-xs text-civic-ivory/55">
          No hotspots match “{query}”.
        </p>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-3 max-h-[clamp(220px,32vh,420px)] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin"
        >
          {filtered.map((h) => {
            const selected = h.cluster_id === value
            const known = h.classification !== 'UNKNOWN'
            return (
              <motion.li key={h.cluster_id} variants={fadeUp}>
                <button
                  type="button"
                  onClick={() => onChange(h.cluster_id)}
                  className={cn(
                    'focus-ring-command flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-btp-cyan/45 bg-btp-cyan/10 shadow-glow-cyan'
                      : 'border-btp-cyan/12 bg-civic-dusk/50 hover:border-btp-cyan/25',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-civic-white">{h.cluster_id}</span>
                    <span className="block truncate text-[11px] text-civic-ivory/50">{formatStation(h.station)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-bold tabular-nums text-btp-cyan">{h.roi.toFixed(1)}</span>
                    {known ? (
                      <StatusBadge status={h.classification as Classification} className="!px-1.5 !py-0 !text-[8px]" />
                    ) : (
                      <span className="rounded-full border border-civic-ivory/20 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wide text-civic-ivory/55">
                        N/A
                      </span>
                    )}
                  </span>
                </button>
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </div>
  )
}
