import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fadeUp } from '@/lib/motion'
import { formatNumber } from '@/lib/formatters'
import type { WeekSnapshot } from '@/data/impactEvidenceData'

interface RowDef {
  key: keyof Pick<
    WeekSnapshot,
    | 'totalPressure'
    | 'structuralHotspots'
    | 'responsiveHotspots'
    | 'repeatRecurrence'
    | 'officerHours'
    | 'escalationReady'
  >
  label: string
  /** lower is better for this metric */
  lowerBetter: boolean
}

const rows: RowDef[] = [
  { key: 'totalPressure', label: 'Total violation pressure', lowerBetter: true },
  { key: 'structuralHotspots', label: 'Structural hotspots', lowerBetter: true },
  { key: 'responsiveHotspots', label: 'Responsive hotspots', lowerBetter: true },
  { key: 'repeatRecurrence', label: 'Repeat recurrence count', lowerBetter: true },
  { key: 'officerHours', label: 'Patrol concentration (est. officer-hrs)', lowerBetter: false },
  { key: 'escalationReady', label: 'Escalation-ready clusters', lowerBetter: false },
]

function WeekCard({
  week,
  variant,
  index,
}: {
  week: WeekSnapshot
  variant: 'baseline' | 'enforcement'
  index: number
}) {
  const accent =
    variant === 'baseline'
      ? 'border-civic-graphite/25'
      : 'border-btp-cyan/30 shadow-glow-cyan'
  const chip =
    variant === 'baseline'
      ? 'bg-civic-white/5 text-shell-muted'
      : 'bg-btp-cyan/15 text-btp-cyan'

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.08 }}
      className={cn(
        'flex-1 rounded-2xl border bg-civic-navy/55 p-5 shadow-command backdrop-blur-xl',
        accent,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-bold text-shell">{week.label}</p>
          <p className="text-xs text-shell-muted">{week.sublabel}</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', chip)}>
          {variant === 'baseline' ? 'Baseline' : 'Prioritised'}
        </span>
      </div>
      <dl className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 border-b border-btp-cyan/8 pb-2 last:border-0 last:pb-0">
            <dt className="text-xs text-shell-muted">{row.label}</dt>
            <dd className="text-sm font-bold tabular-nums text-shell">
              {formatNumber(week[row.key], 0)}
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

export function WeekComparison({
  week1,
  week2,
}: {
  week1: WeekSnapshot
  week2: WeekSnapshot
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
      <WeekCard week={week1} variant="baseline" index={0} />
      <div className="flex shrink-0 items-center justify-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-btp-cyan/25 bg-civic-navy/70 text-btp-cyan">
          <ArrowRight className="h-4 w-4 rotate-90 lg:rotate-0" />
        </span>
      </div>
      <WeekCard week={week2} variant="enforcement" index={1} />
    </div>
  )
}
