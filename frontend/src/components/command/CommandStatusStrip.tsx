import { motion } from 'framer-motion'
import { Activity, CalendarClock, Route, ShieldAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { staggerContainer, fadeUp } from '@/lib/motion'

interface StatusItem {
  icon: LucideIcon
  label: string
  value: string
  sub: string
  tone: 'cyan' | 'amber' | 'structural' | 'route'
}

interface CommandStatusStripProps {
  planStatus: string
  planSub: string
  routesValue: string
  routesSub: string
  escalationValue: string
  escalationSub: string
  agentValue: string
  agentSub: string
  className?: string
}

const TONE: Record<StatusItem['tone'], { text: string; chip: string; bar: string }> = {
  cyan: { text: 'text-btp-cyan', chip: 'bg-btp-cyan/15 text-btp-cyan', bar: 'bg-btp-cyan' },
  amber: { text: 'text-status-amber', chip: 'bg-status-amber/15 text-status-amber', bar: 'bg-status-amber' },
  structural: { text: 'text-status-structural', chip: 'bg-status-structural/15 text-status-structural', bar: 'bg-status-structural' },
  route: { text: 'text-status-route', chip: 'bg-status-route/15 text-status-route', bar: 'bg-status-route' },
}

export function CommandStatusStrip({
  planStatus,
  planSub,
  routesValue,
  routesSub,
  escalationValue,
  escalationSub,
  agentValue,
  agentSub,
  className,
}: CommandStatusStripProps) {
  const items: StatusItem[] = [
    { icon: CalendarClock, label: '4 AM Master Plan', value: planStatus, sub: planSub, tone: 'amber' },
    { icon: Route, label: 'Patrol Route Optimizer', value: routesValue, sub: routesSub, tone: 'route' },
    { icon: ShieldAlert, label: 'Escalation Watch', value: escalationValue, sub: escalationSub, tone: 'structural' },
    { icon: Activity, label: 'Agent State', value: agentValue, sub: agentSub, tone: 'cyan' },
  ]

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}
    >
      {items.map((it) => {
        const tone = TONE[it.tone]
        const Icon = it.icon
        return (
          <motion.div
            key={it.label}
            variants={fadeUp}
            className="relative overflow-hidden rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-3.5 py-3 backdrop-blur-xl"
          >
            <span className={cn('absolute left-0 top-0 h-full w-1', tone.bar)} />
            <div className="flex items-center gap-2">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone.chip)}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wide text-civic-ivory/50">{it.label}</p>
            </div>
            <p className={cn('mt-2 truncate text-base font-bold capitalize', tone.text)}>{it.value}</p>
            <p className="truncate text-[10px] text-civic-ivory/45">{it.sub}</p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
