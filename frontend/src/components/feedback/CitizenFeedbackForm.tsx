import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Send, ShieldAlert } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { formatStation } from '@/lib/formatters'
import { submitCitizenFeedback } from '@/services/feedbackService'
import type { ReasonCode } from '@/types/feedback'
import { FieldSelect, FieldTextarea } from './FormControls'

interface CitizenFeedbackFormProps {
  clusterId: string
  station?: string | null
}

const REASONS: Array<{ value: ReasonCode; label: string }> = [
  { value: 'no_parking_space', label: 'No parking space' },
  { value: 'customer_waiting', label: 'Customer waiting' },
  { value: 'loading', label: 'Loading / unloading' },
  { value: 'other', label: 'Other' },
]

export function CitizenFeedbackForm({ clusterId, station }: CitizenFeedbackFormProps) {
  const queryClient = useQueryClient()
  const [reasonCode, setReasonCode] = useState<ReasonCode>('no_parking_space')
  const [reasonText, setReasonText] = useState('')

  const mutation = useMutation({
    mutationFn: submitCitizenFeedback,
    onSuccess: (res) => {
      if (res.ok) queryClient.invalidateQueries({ queryKey: ['feedback', clusterId] })
    },
  })

  const success = mutation.isSuccess && mutation.data?.ok

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-btp-cyan/15 bg-civic-dusk/60 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Citizen report for</p>
        <p className="mt-0.5 text-base font-bold text-civic-white">{clusterId}</p>
        <p className="text-xs text-civic-ivory/55">{station ? formatStation(station) : 'Station unknown'}</p>
      </div>

      <FieldSelect label="Reason code" value={reasonCode} onChange={(v) => setReasonCode(v as ReasonCode)} options={REASONS} />
      <FieldTextarea label="Reason detail (optional)" value={reasonText} onChange={setReasonText} placeholder="What did you observe at this location?" />

      <div className="flex flex-wrap items-center gap-3">
        <CommandButton
          variant="secondary"
          onClick={() =>
            mutation.mutate({
              cluster_id: clusterId,
              reason_code: reasonCode,
              reason_text: reasonText || undefined,
            })
          }
          disabled={mutation.isPending}
        >
          <Send className="h-4 w-4" />
          {mutation.isPending ? 'Recording…' : 'Submit citizen reason'}
        </CommandButton>

        {success && (
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 18 }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-status-cleared/30 bg-status-cleared/15 px-3 py-1.5 text-xs font-bold text-status-cleared"
          >
            <CheckCircle2 className="h-4 w-4" />
            Reason recorded
          </motion.span>
        )}
      </div>

      {mutation.isError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-status-structural">
          <AlertCircle className="h-3.5 w-3.5" />
          Submission failed — the feedback API is unavailable. Please retry.
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-civic-ivory/12 bg-civic-white/5 px-3 py-2 text-[11px] leading-relaxed text-civic-ivory/55">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-btp-cyan" />
        Citizen reason capture is demo-safe and should be deployed only with a BTP-approved data policy.
      </p>
    </div>
  )
}
