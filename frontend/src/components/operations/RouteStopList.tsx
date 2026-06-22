import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatPatrolWindow } from '@/lib/timezone'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { ApiPatrolStop } from '@/types/api'
import type { Classification } from '@/types/common'

interface RouteStopListProps {
  stops: ApiPatrolStop[]
  className?: string
}

function stopOrder(s: ApiPatrolStop, i: number): number {
  return Number(s.sequence ?? s.order ?? i + 1)
}

export function RouteStopList({ stops, className }: RouteStopListProps) {
  if (stops.length === 0) {
    return (
      <p className={cn('rounded-xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-4 text-center text-xs text-civic-ivory/55', className)}>
        No stops in this route.
      </p>
    )
  }

  return (
    <motion.ol
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn('relative space-y-2', className)}
    >
      {stops.map((s, i) => {
        const order = stopOrder(s, i)
        const clusterId = String(s.cluster_id ?? '')
        const roi = typeof s.roi_score === 'number' ? s.roi_score : null
        const classification = (s as { classification?: string }).classification
        const cls = (classification ?? '').toUpperCase()
        const isLast = i === stops.length - 1
        return (
          <motion.li key={`${clusterId}-${order}`} variants={fadeUp} className="relative">
            {!isLast && (
              <span className="absolute left-[1.05rem] top-9 h-[calc(100%-0.5rem)] w-px bg-gradient-to-b from-status-route/60 to-status-route/10" />
            )}
            <motion.div
              whileHover={{ y: -2 }}
              className="flex items-start gap-3 rounded-xl border border-btp-cyan/12 bg-civic-navy/55 p-3 backdrop-blur-xl transition-colors hover:border-btp-cyan/25"
            >
              <span className="z-10 flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-full border border-status-route/40 bg-status-route/15 text-sm font-bold tabular-nums text-status-route">
                {order}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-civic-white">{clusterId || '—'}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {roi != null && (
                      <span className="text-xs font-bold tabular-nums text-btp-cyan">ROI {roi.toFixed(1)}</span>
                    )}
                    {(cls === 'STRUCTURAL' || cls === 'RESPONSIVE' || cls === 'SEASONAL') && (
                      <StatusBadge status={cls as Classification} className="!px-1.5 !py-0 !text-[8px]" />
                    )}
                  </div>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-civic-ivory/55">
                  {s.location_name && <span className="truncate">{s.location_name}</span>}
                  {s.peak_window && (
                    <>
                      <span className="text-civic-ivory/25">·</span>
                      <span title="Suggested patrol window">
                        {formatPatrolWindow(s.peak_window) ?? s.peak_window}
                      </span>
                    </>
                  )}
                </p>
                {s.recommended_action && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-civic-ivory/65">
                    {s.recommended_action}
                  </p>
                )}
                {clusterId && (
                  <Link
                    to={`/hotspots/${clusterId}`}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-btp-cyan hover:underline"
                  >
                    Open hotspot detail
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
