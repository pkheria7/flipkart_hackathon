import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import type { CommandHotspot } from '@/lib/hotspots'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { Classification } from '@/types/common'
import type { SortMode } from './HotspotFilterBar'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface PriorityBoardProps {
  hotspots: CommandHotspot[]
  sortMode: SortMode
  selectedId?: string | null
  onSelect: (id: string) => void
  onInspect: (id: string) => void
  isLoading?: boolean
  initialLimit?: number
}

const GRID =
  'grid-cols-[2rem_minmax(8rem,1fr)_minmax(6rem,1fr)_5.5rem_4rem_4.5rem_4rem_4rem_minmax(9.5rem,max-content)_4.25rem]'
const GRID_MIN_W = 'min-w-[62rem]'
const LIMIT_OPTIONS = [50, 100, 250] as const
const MOTION_THRESHOLD = 60

export function PriorityBoard({
  hotspots,
  sortMode,
  selectedId,
  onSelect,
  onInspect,
  isLoading,
  initialLimit = 50,
}: PriorityBoardProps) {
  const [limit, setLimit] = useState<number>(initialLimit)
  const effectiveLimit = limit >= hotspots.length ? hotspots.length : limit
  const rows = hotspots.slice(0, effectiveLimit)
  const enableMotion = rows.length <= MOTION_THRESHOLD

  return (
    <div className="overflow-hidden rounded-2xl border border-civic-ink/10 bg-civic-white shadow-soft">
      {/* meta strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-civic-ink/10 bg-civic-mist/60 px-4 py-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-btp-blue">
            {sortMode === 'roi_score' ? 'Ranked by Enforcement Priority (ROI)' : 'Ranked by Violation Count'}
          </p>
          <p className="mt-0.5 text-[10px] text-civic-graphite/80">
            Peak violation windows reflect challan activity, not general traffic volume.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-civic-graphite">
            Showing {rows.length} of {hotspots.length}
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-civic-ink/10 bg-civic-white p-0.5">
            {LIMIT_OPTIONS.map((opt) => (
              <LimitChip key={opt} active={limit === opt} onClick={() => setLimit(opt)}>
                {opt}
              </LimitChip>
            ))}
            <LimitChip
              active={limit >= hotspots.length && hotspots.length > 0}
              onClick={() => setLimit(Number.MAX_SAFE_INTEGER)}
            >
              All
            </LimitChip>
          </div>
        </div>
      </div>

      {/* desktop header */}
      <div className="hidden overflow-x-auto lg:block">
        <div className={cn('border-b border-civic-ink/10 bg-civic-mist/30 px-3 py-2.5 lg:grid lg:items-center lg:gap-2', GRID, GRID_MIN_W)}>
        <HeadCell>#</HeadCell>
        <HeadCell>Cluster</HeadCell>
        <HeadCell>Station</HeadCell>
        <HeadCell>Class</HeadCell>
        <HeadCell active={sortMode === 'roi_score'} title="Enforcement Priority (ROI score)">Priority</HeadCell>
        <HeadCell active={sortMode === 'violation_count'} title="Violation Count (FTVR records)">Violations</HeadCell>
        <HeadCell title="Road Space Blocked (LCLE %)">Blocked %</HeadCell>
        <HeadCell title="Network Importance (BCI)">Network</HeadCell>
        <HeadCell title="Peak Violation Window (IST)">Peak (IST)</HeadCell>
        <HeadCell className="text-right">Action</HeadCell>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-civic-mist/70" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Search className="mb-2 h-6 w-6 text-civic-graphite/50" />
          <p className="text-sm font-semibold text-civic-ink">No hotspots match these filters</p>
          <p className="mt-1 text-xs text-civic-graphite">Try clearing the search or filters.</p>
        </div>
      ) : (
        <motion.div
          {...(enableMotion ? { variants: staggerContainer, initial: 'hidden', animate: 'visible' } : {})}
          className="max-h-[clamp(360px,52vh,640px)] divide-y divide-civic-ink/5 overflow-y-auto overflow-x-auto scrollbar-thin"
        >
          {rows.map((h, i) => {
            const active = h.cluster_id === selectedId
            return (
              <motion.div key={h.cluster_id} {...(enableMotion ? { variants: fadeUp } : {})}>
                {/* desktop row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(h.cluster_id)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(h.cluster_id)}
                  className={cn(
                    'hidden cursor-pointer items-center gap-2 px-3 py-2 transition-colors lg:grid',
                    GRID,
                    GRID_MIN_W,
                    active ? 'bg-btp-cyan/10 ring-1 ring-inset ring-btp-cyan/40' : 'hover:bg-civic-mist/60',
                  )}
                >
                  <span className="text-xs font-bold tabular-nums text-civic-graphite">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-civic-ink">
                      {getHotspotDisplayName(h)}
                    </span>
                    <span className="font-mono text-[9px] text-btp-blue/60">{h.cluster_id}</span>
                  </span>
                  <span className="truncate text-xs text-civic-graphite">{formatStation(h.station)}</span>
                  <span>
                    {h.classification !== 'UNKNOWN' && (
                      <StatusBadge status={h.classification as Classification} className="!px-1.5 !py-0 !text-[8px]" />
                    )}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-btp-blue">{h.roi.toFixed(1)}</span>
                  <span className="text-sm font-semibold tabular-nums text-civic-ink">
                    {h.violations.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs tabular-nums text-civic-graphite">
                    {h.lcle != null ? `${h.lcle.toFixed(0)}%` : '—'}
                  </span>
                  <span className="text-xs tabular-nums text-civic-graphite">
                    {h.bci != null ? h.bci.toFixed(3) : '—'}
                  </span>
                  <span className="whitespace-nowrap text-[11px] tabular-nums text-civic-graphite">
                    {h.peak_window ?? '—'}
                  </span>
                  <span className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspect(h.cluster_id)
                      }}
                      className="focus-ring-command rounded-md border border-btp-blue/25 bg-btp-blue/5 px-2 py-1 text-[10px] font-bold text-btp-blue transition-colors hover:bg-btp-blue hover:text-civic-white"
                    >
                      Inspect
                    </button>
                  </span>
                </div>

                {/* mobile card */}
                <button
                  type="button"
                  onClick={() => onSelect(h.cluster_id)}
                  className={cn(
                    'flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors lg:hidden',
                    active ? 'bg-btp-cyan/10' : 'hover:bg-civic-mist/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums text-civic-graphite">#{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-civic-ink">
                          {getHotspotDisplayName(h)}
                        </span>
                        <span className="font-mono text-[9px] text-btp-blue/60">{h.cluster_id}</span>
                      </span>
                      {h.classification !== 'UNKNOWN' && (
                        <StatusBadge status={h.classification as Classification} className="!px-1.5 !py-0 !text-[8px]" />
                      )}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-btp-blue">{h.roi.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-civic-graphite">
                    <span className="min-w-0 truncate">{formatStation(h.station)}</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">{h.peak_window ?? '—'}</span>
                  </div>
                  <div className="text-[11px] tabular-nums text-civic-graphite">
                    {h.violations.toLocaleString('en-IN')} violations · Road blocked {h.lcle != null ? `${h.lcle.toFixed(0)}%` : '—'}
                  </div>
                </button>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function LimitChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'focus-ring-command rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors',
        active ? 'bg-btp-blue text-civic-white' : 'text-civic-graphite hover:bg-civic-mist',
      )}
    >
      {children}
    </button>
  )
}

function HeadCell({
  children,
  className,
  active,
  title,
}: {
  children: React.ReactNode
  className?: string
  active?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'cursor-default whitespace-nowrap text-[9px] font-bold uppercase tracking-wide',
        active ? 'text-btp-blue' : 'text-civic-graphite',
        className,
      )}
    >
      {children}
    </span>
  )
}
