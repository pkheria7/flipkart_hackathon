import { motion } from 'framer-motion'
import { ArrowRight, ClipboardCheck, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fadeUp, staggerContainer } from '@/lib/motion'
import type { InsightTone, OfficerInsight, RecommendedAction } from '@/data/impactEvidenceData'

const dotTone: Record<InsightTone, string> = {
  cleared: 'bg-status-cleared',
  amber: 'bg-status-amber',
  structural: 'bg-status-structural',
  cyan: 'bg-btp-cyan',
}

const actionTone: Record<InsightTone, string> = {
  cleared: 'border-status-cleared/30 bg-status-cleared/10',
  amber: 'border-status-amber/30 bg-status-amber/10',
  structural: 'border-status-structural/30 bg-status-structural/10',
  cyan: 'border-btp-cyan/25 bg-btp-cyan/10',
}

const actionText: Record<InsightTone, string> = {
  cleared: 'text-status-cleared',
  amber: 'text-status-amber',
  structural: 'text-status-structural',
  cyan: 'text-btp-cyan',
}

interface OfficerSummaryPanelProps {
  insights: OfficerInsight[]
  actions: RecommendedAction[]
}

export function OfficerSummaryPanel({ insights, actions }: OfficerSummaryPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* What changed? */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 shadow-command backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-btp-cyan/10 text-btp-cyan">
            <Lightbulb className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-btp-cyan">
              Officer summary
            </p>
            <h3 className="text-sm font-bold text-shell">What changed this window?</h3>
          </div>
        </div>
        <motion.ul variants={staggerContainer} initial="hidden" animate="visible" className="mt-4 space-y-2.5">
          {insights.map((insight, i) => (
            <motion.li key={i} variants={fadeUp} className="flex items-start gap-2.5">
              <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dotTone[insight.tone])} />
              <span className="text-sm leading-relaxed text-shell">{insight.text}</span>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      {/* Recommended action */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 shadow-command backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-cleared/10 text-status-cleared">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-status-cleared">
              Recommended action
            </p>
            <h3 className="text-sm font-bold text-shell">What officers should do next</h3>
          </div>
        </div>
        <motion.ul variants={staggerContainer} initial="hidden" animate="visible" className="mt-4 space-y-2.5">
          {actions.map((action, i) => (
            <motion.li
              key={i}
              variants={fadeUp}
              className={cn('rounded-xl border p-3', actionTone[action.tone])}
            >
              <div className="flex items-center gap-2">
                <ArrowRight className={cn('h-3.5 w-3.5 shrink-0', actionText[action.tone])} />
                <p className={cn('text-sm font-bold', actionText[action.tone])}>{action.title}</p>
              </div>
              <p className="mt-1 pl-6 text-xs leading-relaxed text-shell-muted">{action.detail}</p>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>
    </div>
  )
}
