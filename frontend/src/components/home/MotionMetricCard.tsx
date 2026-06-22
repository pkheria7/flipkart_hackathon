import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CountUpNumber } from '@/components/home/CountUpNumber'
import { cn } from '@/lib/cn'
import { fadeUp, prefersReducedMotion } from '@/lib/motion'

export type SnapshotMetricTone = 'cyan' | 'structural' | 'amber' | 'route'

export interface SnapshotMetric {
  id: string
  label: string
  microcopy: string
  /** Numeric value for count-up; omit when using fallbackDisplay. */
  value?: number
  fallbackDisplay?: string
  tone: SnapshotMetricTone
  icon: LucideIcon
  featured?: boolean
}

const TONE_STYLES: Record<
  SnapshotMetricTone,
  { text: string; bar: string; chip: string; glow: string; hoverBar: string }
> = {
  cyan: {
    text: 'text-btp-cyan',
    bar: 'from-btp-signal via-btp-cyan to-btp-cyan/40',
    chip: 'bg-btp-cyan/10 text-btp-cyan',
    glow: 'hover:border-btp-cyan/45 hover:shadow-glow-cyan',
    hoverBar: 'group-hover:shadow-[0_0_12px_rgba(34,211,238,0.55)]',
  },
  structural: {
    text: 'text-status-structural',
    bar: 'from-status-structural via-status-structural to-status-structural/40',
    chip: 'bg-status-structural/10 text-status-structural',
    glow: 'hover:border-status-structural/45 hover:shadow-glow-red',
    hoverBar: 'group-hover:shadow-[0_0_12px_rgba(214,40,40,0.45)]',
  },
  amber: {
    text: 'text-status-amber',
    bar: 'from-status-amber via-status-route to-status-amber/40',
    chip: 'bg-status-amber/10 text-status-amber',
    glow: 'hover:border-status-amber/45 hover:shadow-glow-amber',
    hoverBar: 'group-hover:shadow-[0_0_12px_rgba(245,158,11,0.45)]',
  },
  route: {
    text: 'text-status-route',
    bar: 'from-status-route via-status-route to-status-route/40',
    chip: 'bg-status-route/10 text-status-route',
    glow: 'hover:border-status-route/45 hover:shadow-glow-amber',
    hoverBar: 'group-hover:shadow-[0_0_12px_rgba(249,115,22,0.45)]',
  },
}

interface MotionMetricCardProps {
  metric: SnapshotMetric
}

export function MotionMetricCard({ metric }: MotionMetricCardProps) {
  const t = TONE_STYLES[metric.tone]
  const Icon = metric.icon
  const reduced = prefersReducedMotion()
  const showCountUp = typeof metric.value === 'number'

  return (
    <motion.article
      variants={fadeUp}
      whileHover={reduced ? undefined : { y: -6, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-btp-cyan/12 bg-gradient-to-b from-civic-navy/75 to-civic-dusk/70 backdrop-blur-xl transition-[border-color,box-shadow] duration-300',
        metric.featured ? 'p-5 ring-1 ring-btp-cyan/15 sm:min-h-[168px]' : 'p-4',
        t.glow,
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80 transition-shadow duration-300',
          t.bar,
          t.hoverBar,
        )}
      />

      <span
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-35',
          metric.tone === 'cyan' ? 'bg-btp-cyan' : metric.tone === 'structural' ? 'bg-status-structural' : metric.tone === 'amber' ? 'bg-status-amber' : 'bg-status-route',
        )}
      />

      <div className="relative flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t.chip)}>
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-civic-ivory/25 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-civic-ivory/55" />
      </div>

      <p
        className={cn(
          'relative mt-3 font-bold leading-none tabular-nums',
          metric.featured ? 'text-[1.85rem] sm:text-[2rem]' : 'text-[1.6rem]',
          t.text,
        )}
      >
        {showCountUp ? (
          <CountUpNumber value={metric.value!} />
        ) : (
          metric.fallbackDisplay ?? '—'
        )}
      </p>

      <p className="relative mt-2 text-[10px] font-semibold uppercase tracking-wide text-civic-ivory/60">
        {metric.label}
      </p>
      <p className="relative mt-1 text-[11px] leading-snug text-civic-ivory/45">{metric.microcopy}</p>
    </motion.article>
  )
}
