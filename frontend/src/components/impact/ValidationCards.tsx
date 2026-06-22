import { motion } from 'framer-motion'
import { Database, Repeat, MessagesSquare, ClipboardCheck, type LucideIcon } from 'lucide-react'
import { fadeUp, staggerContainer } from '@/lib/motion'

interface ValidationCard {
  icon: LucideIcon
  title: string
  body: string
  status: string
  ready: boolean
}

const cards: ValidationCard[] = [
  {
    icon: Database,
    title: 'FTVR baseline',
    body: 'Week 1 uses real FTVR violation records as the baseline enforcement signal.',
    status: 'Baseline',
    ready: true,
  },
  {
    icon: Repeat,
    title: 'Recurring clusters',
    body: 'Clusters that reappear across windows are treated as persistent problem locations.',
    status: 'Recurring',
    ready: true,
  },
  {
    icon: MessagesSquare,
    title: 'Officer feedback',
    body: 'Enforcement feedback can push a hotspot toward structural status over time.',
    status: 'Active',
    ready: true,
  },
  {
    icon: ClipboardCheck,
    title: 'Field review',
    body: 'Real-world improvement still needs field review before any firm conclusion.',
    status: 'Field review',
    ready: false,
  },
]

export function ValidationCards() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <motion.div
          key={card.title}
          variants={fadeUp}
          className="flex flex-col rounded-2xl border border-btp-cyan/25 bg-civic-mist/92 p-4 text-civic-ink shadow-soft"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-btp-blue/10 text-btp-blue">
              <card.icon className="h-4 w-4" />
            </span>
            <span
              className={
                card.ready
                  ? 'rounded-full bg-status-cleared/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-cleared'
                  : 'rounded-full bg-status-amber/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-amber'
              }
            >
              {card.status}
            </span>
          </div>
          <h3 className="mt-3 text-sm font-bold text-civic-ink">{card.title}</h3>
          <p className="mt-1.5 flex-1 text-xs leading-relaxed text-civic-graphite">{card.body}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
