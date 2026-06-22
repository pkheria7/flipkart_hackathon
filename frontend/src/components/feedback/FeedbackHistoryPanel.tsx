import { motion } from 'framer-motion'
import { History, MessageSquare, RefreshCw, ShieldCheck, User } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type {
  CitizenFeedbackEvent,
  FeedbackClusterResponse,
  OfficerFeedbackEvent,
} from '@/types/feedback'

interface FeedbackHistoryPanelProps {
  feedback: FeedbackClusterResponse | null
  isLoading?: boolean
}

const MAX_EVENTS = 15

function tidy(value: unknown): string {
  if (value == null || value === '') return '—'
  return String(value).replace(/_/g, ' ')
}

function officerTime(e: OfficerFeedbackEvent): string {
  return String(e.feedback_timestamp_ist ?? e.feedback_date ?? e.created_at_ist ?? '')
}

export function FeedbackHistoryPanel({ feedback, isLoading }: FeedbackHistoryPanelProps) {
  if (isLoading) return <LoadingSkeleton lines={5} />

  const officer = feedback?.officer_feedback ?? []
  const citizen = feedback?.citizen_feedback ?? []
  const summary = feedback?.summary
  const total = officer.length + citizen.length

  // newest first, capped
  const officerRecent = [...officer].reverse().slice(0, MAX_EVENTS)
  const citizenRecent = [...citizen].reverse().slice(0, MAX_EVENTS)

  return (
    <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-btp-cyan">
          <History className="h-3.5 w-3.5" />
          Feedback history
        </p>
        {feedback?.cluster_id && <span className="text-[10px] text-civic-ivory/45">{feedback.cluster_id}</span>}
      </div>

      {/* counts */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Officer" value={summary?.officer_event_count ?? officer.length} />
        <Stat label="Citizen" value={summary?.citizen_event_count ?? citizen.length} />
        <Stat label="Recurred" value={summary?.recurred_after_enforcement_count ?? 0} tone="amber" />
      </div>

      {total === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-btp-cyan/20 p-6 text-center">
          <MessageSquare className="mx-auto mb-2 h-6 w-6 text-civic-ivory/35" />
          <p className="text-xs text-civic-ivory/55">No feedback recorded yet for this cluster.</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-4 max-h-[clamp(260px,40vh,520px)] space-y-2 overflow-y-auto pr-1 scrollbar-thin"
        >
          {officerRecent.map((e, i) => {
            const recurred = e.recurred_after_enforcement === 1 || e.outcome === 'recurred'
            return (
              <motion.div
                key={`o-${e.id ?? i}`}
                variants={fadeUp}
                className="rounded-xl border border-btp-cyan/12 bg-civic-dusk/55 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-civic-white">
                    <User className="h-3 w-3 text-btp-signal" />
                    Officer · {tidy(e.action_type ?? e.action)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0 text-[8px] font-bold uppercase tracking-wide',
                      recurred
                        ? 'border-status-structural/30 bg-status-structural/12 text-status-structural'
                        : 'border-status-cleared/30 bg-status-cleared/12 text-status-cleared',
                    )}
                  >
                    {tidy(e.outcome)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-civic-ivory/50">
                  {e.officer_id && <span>{e.officer_id}</span>}
                  {recurred && (
                    <span className="flex items-center gap-1 text-status-amber">
                      <RefreshCw className="h-2.5 w-2.5" />
                      recurred
                    </span>
                  )}
                  {officerTime(e) && <span>{officerTime(e)}</span>}
                  {e.source && <span className="rounded bg-civic-white/5 px-1 py-0.5">{tidy(e.source)}</span>}
                </div>
                {e.notes && <p className="mt-1 text-[11px] text-civic-ivory/65">{String(e.notes)}</p>}
              </motion.div>
            )
          })}

          {citizenRecent.map((e: CitizenFeedbackEvent, i) => (
            <motion.div
              key={`c-${e.id ?? i}`}
              variants={fadeUp}
              className="rounded-xl border border-btp-cyan/12 bg-civic-dusk/55 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-civic-white">
                  <ShieldCheck className="h-3 w-3 text-btp-cyan" />
                  Citizen · {tidy(e.reason_code)}
                </span>
                {e.source && (
                  <span className="rounded bg-civic-white/5 px-1 py-0.5 text-[8px] uppercase tracking-wide text-civic-ivory/50">
                    {tidy(e.source)}
                  </span>
                )}
              </div>
              {(e.reason_text || e.created_at) && (
                <div className="mt-1 text-[10px] text-civic-ivory/50">
                  {e.reason_text && <p className="text-[11px] text-civic-ivory/65">{String(e.reason_text)}</p>}
                  {e.created_at && <span>{String(e.created_at)}</span>}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'amber' }) {
  return (
    <div className="rounded-xl border border-btp-cyan/12 bg-civic-dusk/55 px-2 py-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', tone === 'amber' ? 'text-status-amber' : 'text-civic-white')}>
        {value}
      </p>
    </div>
  )
}
