import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { fadeUp } from '@/lib/motion'
import type { BriefReadiness } from '@/data/impactEvidenceData'

interface Row {
  label: string
  value: number
  tone: string
}

export function BriefReadinessCard({
  readiness,
  generatedPdfs,
}: {
  readiness: BriefReadiness
  generatedPdfs: number
}) {
  const rows: Row[] = [
    { label: 'Recommended for brief review', value: readiness.ready, tone: 'text-status-cleared' },
    { label: 'Generated PDF briefs', value: generatedPdfs, tone: 'text-btp-cyan' },
    { label: 'Needs BBMP/BTP escalation', value: readiness.bbmpEscalation, tone: 'text-status-structural' },
  ]

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex h-full flex-col rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-5 shadow-command backdrop-blur-xl"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-btp-cyan/10 text-btp-cyan">
          <FileText className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-btp-cyan">Evidence brief</p>
          <h3 className="text-sm font-bold text-shell">Brief Readiness</h3>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-btp-cyan/10 bg-civic-dusk/50 px-3 py-2.5"
          >
            <dt className="text-xs text-shell-muted">{row.label}</dt>
            <dd className={`text-lg font-bold tabular-nums ${row.tone}`}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <Link
        to="/feedback-escalation?tab=briefs"
        className="focus-ring-command mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-btp-blue px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-glow-cyan"
      >
        Open escalation briefs
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-2 text-center text-[10px] text-shell-muted">
        Generated PDFs are available in Feedback &amp; Escalation.
      </p>
    </motion.div>
  )
}
