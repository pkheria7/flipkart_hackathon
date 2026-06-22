import { useQuery } from '@tanstack/react-query'
import { getFeedback } from '@/services/feedbackService'
import { FeedbackBoostAnimation } from '@/components/motion/FeedbackBoostAnimation'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { StatusBadge } from '@/components/ui/StatusBadge'

export function FeedbackPage() {
  const { data: feedback } = useQuery({
    queryKey: ['feedback'],
    queryFn: getFeedback,
  })

  const recurred = feedback?.officer_feedback.find((f) => f.outcome === 'recurred')

  return (
    <PageScaffold
      eyebrow="Field"
      title="Officer + Citizen Feedback"
      description="Officer/citizen feedback loop coming in Phase 6"
    >
      <FeedbackBoostAnimation />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <p className="mb-3 text-sm font-medium text-slate-700">Officer Feedback</p>
          <ul className="space-y-2">
            {feedback?.officer_feedback.map((f) => (
              <li key={`${f.cluster_id}-${f.timestamp}`} className="flex justify-between text-sm">
                <span>{f.cluster_id} — {f.action}</span>
                <StatusBadge status={f.outcome === 'recurred' ? 'RECURRENCE' : 'CLEARED'} />
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard>
          <p className="mb-3 text-sm font-medium text-slate-700">Citizen Feedback</p>
          <ul className="space-y-2">
            {feedback?.citizen_feedback.map((f) => (
              <li key={f.timestamp} className="text-sm text-slate-600">
                {f.cluster_id}: {f.reason_text ?? f.reason_code}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
      {recurred && (
        <GlassCard className="mt-4 border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-800">
            Recurrence detected at {recurred.cluster_id}: {recurred.reason_text}
          </p>
        </GlassCard>
      )}
    </PageScaffold>
  )
}
