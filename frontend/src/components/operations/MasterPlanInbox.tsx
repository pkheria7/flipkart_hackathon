import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, FileStack, Truck, User } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { formatStation, formatTimestamp } from '@/lib/formatters'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { NormalizedPlan } from '@/lib/masterPlan'

interface MasterPlanInboxProps {
  daily: NormalizedPlan | null
  pending: NormalizedPlan | null
  approved: NormalizedPlan | null
  isLoading?: boolean
}

type Source = 'daily' | 'pending' | 'approved'

const ASSIGNMENT_CAP = 60

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-status-amber/30 bg-status-amber/15 text-status-amber',
  approved: 'border-status-cleared/30 bg-status-cleared/15 text-status-cleared',
  dispatched: 'border-btp-cyan/30 bg-btp-cyan/15 text-btp-cyan',
  generated: 'border-btp-cyan/25 bg-btp-cyan/10 text-btp-cyan',
  unknown: 'border-civic-ivory/20 bg-civic-white/5 text-civic-ivory/60',
}

export function MasterPlanInbox({ daily, pending, approved, isLoading }: MasterPlanInboxProps) {
  const available = useMemo(
    () =>
      (
        [
          ['approved', approved],
          ['pending', pending],
          ['daily', daily],
        ] as Array<[Source, NormalizedPlan | null]>
      ).filter(([, p]) => p != null),
    [approved, pending, daily],
  )

  const [source, setSource] = useState<Source | null>(null)
  const activeSource = source ?? available[0]?.[0] ?? null
  const plan =
    activeSource === 'approved' ? approved : activeSource === 'pending' ? pending : activeSource === 'daily' ? daily : null

  if (isLoading) return <LoadingSkeleton lines={5} />

  if (!plan) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center">
        <FileStack className="mx-auto mb-3 h-8 w-8 text-btp-cyan/50" />
        <p className="text-sm font-semibold text-civic-white">No master plan available</p>
        <p className="mt-1 text-xs text-civic-ivory/55">
          The 4 AM agent run generates the daily master plan.
        </p>
      </div>
    )
  }

  const accentPending = plan.status === 'pending'
  const shownAssignments = plan.assignments.slice(0, ASSIGNMENT_CAP)

  return (
    <div className="space-y-4">
      {/* source selector */}
      {available.length > 1 && (
        <div className="inline-flex items-center gap-1 rounded-xl border border-btp-cyan/12 bg-civic-navy/55 p-1 backdrop-blur-xl">
          {available.map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className={cn(
                'focus-ring-command rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                activeSource === key ? 'bg-btp-blue/80 text-civic-white shadow-glow-cyan' : 'text-civic-ivory/55 hover:text-civic-white',
              )}
            >
              {key} plan
            </button>
          ))}
        </div>
      )}

      {/* header */}
      <div
        className={cn(
          'rounded-2xl border bg-civic-navy/55 p-4 backdrop-blur-xl',
          accentPending ? 'border-status-amber/30 shadow-glow-amber' : 'border-btp-cyan/15',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-btp-cyan">
              <CalendarClock className="h-3 w-3" />
              {activeSource} master plan
            </p>
            <p className="mt-0.5 text-lg font-bold text-civic-white">{plan.runId ?? plan.date ?? 'Master plan'}</p>
            <p className="text-xs text-civic-ivory/55">
              {plan.generatedAt ? formatTimestamp(plan.generatedAt) : '—'}
              {plan.routingMode ? ` · routing ${plan.routingMode}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATUS_STYLE[plan.status] ?? STATUS_STYLE.unknown)}>
              {plan.status}
            </span>
            <span className="text-sm font-bold tabular-nums text-civic-white">
              {plan.totalAssignments} assignments
            </span>
          </div>
        </div>
      </div>

      {/* station summaries */}
      {plan.stationSummaries.length > 0 && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {plan.stationSummaries.map((s) => (
            <motion.div key={s.station} variants={fadeUp} className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-3 py-2.5 backdrop-blur-xl">
              <p className="truncate text-xs font-bold text-civic-white">{formatStation(s.station)}</p>
              <p className="mt-1 text-[11px] text-civic-ivory/55">
                {s.count} assignments{s.avgRoi != null ? ` · avg ROI ${s.avgRoi.toFixed(1)}` : ''}
              </p>
              <div className="mt-1 flex gap-2 text-[10px]">
                <span className="text-status-structural">{s.structural} struct</span>
                <span className="text-btp-cyan">{s.responsive} resp</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* assignments */}
      <div className="overflow-hidden rounded-2xl border border-civic-ink/10 bg-civic-white shadow-soft">
        <div className="flex items-center justify-between border-b border-civic-ink/10 bg-civic-mist/60 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-btp-blue">Assignments</p>
          <p className="text-[11px] text-civic-graphite">
            Showing {shownAssignments.length} of {plan.assignments.length}
          </p>
        </div>
        <div className="max-h-[clamp(320px,46vh,560px)] divide-y divide-civic-ink/5 overflow-y-auto scrollbar-thin">
          {shownAssignments.map((a, i) => (
            <div key={`${a.cluster_id}-${i}`} className="px-4 py-3 transition-colors hover:bg-civic-mist/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-btp-blue/10 px-2 py-0.5 text-[11px] font-bold text-btp-blue">
                    {a.time_window ?? '—'}
                  </span>
                  <span className="text-sm font-bold text-civic-ink">{a.cluster_id}</span>
                  <span className="text-xs text-civic-graphite">{formatStation(a.station)}</span>
                </span>
                <span className="flex items-center gap-3 text-[11px] text-civic-graphite">
                  {a.roi != null && <span className="font-bold text-btp-blue">Priority {a.roi.toFixed(1)}</span>}
                  {a.lcle != null && <span>Road blocked {a.lcle.toFixed(0)}%</span>}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-civic-graphite">
                {a.officer_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-btp-signal" />
                    {a.officer_name}
                  </span>
                )}
                {a.tow_truck_id && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3 text-status-route" />
                    {a.tow_truck_id}
                  </span>
                )}
              </div>
              {a.action && <p className="mt-1 text-xs leading-relaxed text-civic-ink/80">{a.action}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
