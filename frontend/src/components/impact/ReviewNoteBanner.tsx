import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { fadeUp } from '@/lib/motion'

/**
 * Compact, officer-facing review note. Operational framing only —
 * methodology detail lives in the collapsible "Method note" inside details.
 */
export function ReviewNoteBanner() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-3 rounded-xl border border-btp-cyan/20 bg-civic-navy/55 px-4 py-3 shadow-soft backdrop-blur-xl"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-btp-cyan/12 text-btp-cyan">
        <Info className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-btp-cyan">Review Note</p>
        <p className="text-sm leading-snug text-shell">
          Use this screen to compare enforcement windows and identify clusters needing patrol,
          review, or escalation.
        </p>
      </div>
    </motion.div>
  )
}
