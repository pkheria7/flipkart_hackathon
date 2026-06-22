import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fadeUp } from '@/lib/motion'

type MetricTone = 'blue' | 'structural' | 'amber' | 'cyan' | 'seasonal' | 'cleared'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: string
  icon?: LucideIcon
  tone?: MetricTone
  index?: number
}

const toneText: Record<MetricTone, string> = {
  blue: 'text-btp-cyan',
  structural: 'text-status-structural',
  amber: 'text-status-amber',
  cyan: 'text-btp-cyan',
  seasonal: 'text-status-seasonal',
  cleared: 'text-status-cleared',
}

const toneAccent: Record<MetricTone, string> = {
  blue: 'from-btp-signal/70 to-btp-cyan/70',
  structural: 'from-status-structural/80 to-status-structural/30',
  amber: 'from-status-amber/80 to-status-route/40',
  cyan: 'from-btp-cyan/80 to-btp-signal/40',
  seasonal: 'from-status-seasonal/80 to-status-seasonal/30',
  cleared: 'from-status-cleared/80 to-status-cleared/30',
}

const toneChip: Record<MetricTone, string> = {
  blue: 'bg-btp-cyan/10 text-btp-cyan',
  structural: 'bg-status-structural/10 text-status-structural',
  amber: 'bg-status-amber/10 text-status-amber',
  cyan: 'bg-btp-cyan/10 text-btp-cyan',
  seasonal: 'bg-status-seasonal/10 text-status-seasonal',
  cleared: 'bg-status-cleared/10 text-status-cleared',
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'blue',
  index = 0,
}: MetricCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3 }}
      transition={{ delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 shadow-command backdrop-blur-xl"
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80',
          toneAccent[tone],
        )}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-civic-ivory/55">
          {label}
        </span>
        {Icon && (
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneChip[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className={cn('mt-3 text-2xl font-bold tabular-nums tracking-tight', toneText[tone])}>
        {value}
      </div>
      {delta && <span className="text-xs text-civic-ivory/50">{delta}</span>}
    </motion.div>
  )
}
