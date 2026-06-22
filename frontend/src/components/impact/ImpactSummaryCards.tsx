import { motion } from 'framer-motion'
import {
  FileCheck2,
  Gauge,
  Layers,
  Repeat2,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { useCountUp } from '@/lib/useCountUp'
import type { ImpactKpis } from '@/data/impactEvidenceData'

type Tone = 'cleared' | 'amber' | 'structural' | 'cyan' | 'blue'

const toneText: Record<Tone, string> = {
  cleared: 'text-status-cleared',
  amber: 'text-status-amber',
  structural: 'text-status-structural',
  cyan: 'text-btp-cyan',
  blue: 'text-btp-cyan',
}

const toneAccent: Record<Tone, string> = {
  cleared: 'from-status-cleared/80 to-status-cleared/20',
  amber: 'from-status-amber/80 to-status-route/30',
  structural: 'from-status-structural/80 to-status-structural/20',
  cyan: 'from-btp-cyan/80 to-btp-signal/30',
  blue: 'from-btp-signal/70 to-btp-cyan/40',
}

const toneChip: Record<Tone, string> = {
  cleared: 'bg-status-cleared/10 text-status-cleared',
  amber: 'bg-status-amber/10 text-status-amber',
  structural: 'bg-status-structural/10 text-status-structural',
  cyan: 'bg-btp-cyan/10 text-btp-cyan',
  blue: 'bg-btp-cyan/10 text-btp-cyan',
}

function CountUpNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
}) {
  const animated = useCountUp(value)
  return (
    <span className="tabular-nums">
      {prefix}
      {animated.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

interface KpiCardProps {
  label: string
  helper: string
  icon: LucideIcon
  tone: Tone
  index: number
  children: React.ReactNode
}

function KpiCard({ label, helper, icon: Icon, tone, index, children }: KpiCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 shadow-command backdrop-blur-xl"
    >
      <span className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80', toneAccent[tone])} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-shell-muted">
          {label}
        </span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', toneChip[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className={cn('mt-2 text-2xl font-bold tracking-tight', toneText[tone])}>{children}</div>
      <span className="mt-1 block text-[10px] font-medium text-shell-muted">{helper}</span>
    </motion.div>
  )
}

export function ImpactSummaryCards({ kpis }: { kpis: ImpactKpis }) {
  const pressureImproved = kpis.pressureChangePct <= 0
  const recurringImproved = kpis.recurringAfter < kpis.recurringBefore

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      <KpiCard
        label="Pressure Change"
        helper="vs previous window"
        icon={TrendingDown}
        tone={pressureImproved ? 'cleared' : 'amber'}
        index={0}
      >
        <CountUpNumber
          value={Math.abs(kpis.pressureChangePct)}
          decimals={1}
          prefix={pressureImproved ? '-' : '+'}
          suffix="%"
        />
      </KpiCard>

      <KpiCard
        label="Recurring Hotspots"
        helper="still active"
        icon={Repeat2}
        tone={recurringImproved ? 'cleared' : 'amber'}
        index={1}
      >
        <span className="tabular-nums">
          {kpis.recurringBefore} <span className="text-shell-muted">→</span>{' '}
          <CountUpNumber value={kpis.recurringAfter} />
        </span>
      </KpiCard>

      <KpiCard label="High-ROI Clusters" helper="priority clusters" icon={Layers} tone="cyan" index={2}>
        <CountUpNumber value={kpis.highRoiPrioritized} />
      </KpiCard>

      <KpiCard label="Patrol Efficiency" helper="vs previous window" icon={Gauge} tone="cyan" index={3}>
        <CountUpNumber value={kpis.patrolEfficiencyGainPct} prefix="+" suffix="%" />
      </KpiCard>

      <KpiCard label="Briefs Ready" helper="ready for review" icon={FileCheck2} tone="blue" index={4}>
        <CountUpNumber value={kpis.escalationBriefs} />
      </KpiCard>
    </motion.div>
  )
}
