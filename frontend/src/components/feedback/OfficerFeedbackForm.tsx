import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Info, Send } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { submitOfficerFeedback } from '@/services/feedbackService'
import type {
  OfficerAction,
  FeedbackOutcome,
  ReasonCode,
} from '@/types/feedback'
import { FieldSelect, FieldInput, FieldTextarea } from './FormControls'

interface OfficerFeedbackFormProps {
  clusterId: string
  station?: string | null
  onSubmitted?: (recurred: boolean) => void
}

const ACTIONS: Array<{ value: OfficerAction; label: string }> = [
  { value: 'towed', label: 'Towed' },
  { value: 'warned', label: 'Warned' },
  { value: 'could_not_enforce', label: 'Could not enforce' },
]
const OUTCOMES: Array<{ value: FeedbackOutcome; label: string }> = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'recurred', label: 'Recurred after enforcement' },
  { value: 'no_violation', label: 'No violation' },
]
const REASONS: Array<{ value: ReasonCode; label: string }> = [
  { value: 'no_parking_space', label: 'No parking space' },
  { value: 'loading', label: 'Loading / unloading' },
  { value: 'broke_down', label: 'Vehicle broke down' },
  { value: 'ignored_sign', label: 'Ignored signage' },
  { value: 'customer_waiting', label: 'Customer waiting' },
  { value: 'other', label: 'Other' },
]

export function OfficerFeedbackForm({ clusterId, station, onSubmitted }: OfficerFeedbackFormProps) {
  const queryClient = useQueryClient()
  const [officerId, setOfficerId] = useState('OFF_DEMO_01')
  const [action, setAction] = useState<OfficerAction>('towed')
  const [outcome, setOutcome] = useState<FeedbackOutcome>('recurred')
  const [reasonCode, setReasonCode] = useState<ReasonCode>('no_parking_space')
  const [reasonText, setReasonText] = useState('')

  const mutation = useMutation({
    mutationFn: submitOfficerFeedback,
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['feedback', clusterId] })
        if (outcome === 'recurred') onSubmitted?.(true)
        else onSubmitted?.(false)
      }
    },
  })

  const success = mutation.isSuccess && mutation.data?.ok
  const willBoost = outcome === 'recurred'

  return (
    <div className="space-y-4">
      {/* selected hotspot context */}
      <div className="rounded-xl border border-btp-cyan/15 bg-civic-dusk/60 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Reporting on</p>
        <p className="mt-0.5 text-base font-bold text-civic-white">{clusterId}</p>
        <p className="text-xs text-civic-ivory/55">{station ? formatStation(station) : 'Station unknown'}</p>
      </div>

      {/* hint */}
      <p className="flex items-start gap-2 rounded-xl border border-status-amber/25 bg-status-amber/10 px-3 py-2 text-[11px] leading-relaxed text-status-amber">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Choose <strong>“Recurred after enforcement”</strong> to demonstrate the structural boost signal.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldInput label="Officer ID" value={officerId} onChange={setOfficerId} placeholder="OFF_DEMO_01" />
        <FieldSelect label="Action" value={action} onChange={(v) => setAction(v as OfficerAction)} options={ACTIONS} />
        <FieldSelect label="Outcome" value={outcome} onChange={(v) => setOutcome(v as FeedbackOutcome)} options={OUTCOMES} />
        <FieldSelect label="Reason code" value={reasonCode} onChange={(v) => setReasonCode(v as ReasonCode)} options={REASONS} />
      </div>
      <FieldTextarea label="Notes (optional)" value={reasonText} onChange={setReasonText} placeholder="Free-text context for this enforcement outcome…" />

      <div className="flex flex-wrap items-center gap-3">
        <CommandButton
          variant={willBoost ? 'amber' : 'cyan'}
          onClick={() =>
            mutation.mutate({
              cluster_id: clusterId,
              officer_id: officerId || undefined,
              action,
              outcome,
              reason_code: reasonCode,
              assigned_station: station ?? undefined,
              reason_text: reasonText || undefined,
            })
          }
          disabled={mutation.isPending}
        >
          <Send className="h-4 w-4" />
          {mutation.isPending ? 'Recording…' : 'Submit officer feedback'}
        </CommandButton>

        {success && (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 18 }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold',
              willBoost
                ? 'border-status-structural/30 bg-status-structural/15 text-status-structural'
                : 'border-status-cleared/30 bg-status-cleared/15 text-status-cleared',
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {willBoost ? 'Recorded — structural boost signal queued' : 'Feedback recorded'}
          </motion.span>
        )}
      </div>

      {success && (
        <p className="text-[11px] text-civic-ivory/45">
          Structural boost signal recorded for next scoring run (scoring is not re-run live).
        </p>
      )}
      {mutation.isError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-status-structural">
          <AlertCircle className="h-3.5 w-3.5" />
          Submission failed — the feedback API is unavailable. Please retry.
        </p>
      )}
    </div>
  )
}
