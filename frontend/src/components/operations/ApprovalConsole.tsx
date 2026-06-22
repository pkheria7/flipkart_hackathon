import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, CheckCircle2, FileEdit, ShieldCheck } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { cn } from '@/lib/cn'
import { fadeUp } from '@/lib/motion'
import { approveMasterPlan } from '@/services/masterPlanService'
import type { NormalizedPlan } from '@/lib/masterPlan'

interface ApprovalConsoleProps {
  status: string
  pendingPlan: NormalizedPlan | null
  approvedPlan: NormalizedPlan | null
}

const STEPS = ['Generated', 'Pending Review', 'Approved', 'Dry-run Dispatch']

function reachedIndex(status: string): number {
  switch (status) {
    case 'dispatched':
      return 3
    case 'approved':
      return 2
    case 'pending':
    case 'generated':
      return 1
    default:
      return 0
  }
}

export function ApprovalConsole({ status, pendingPlan, approvedPlan }: ApprovalConsoleProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: approveMasterPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['pendingMasterPlan'] })
      queryClient.invalidateQueries({ queryKey: ['approvedMasterPlan'] })
      queryClient.invalidateQueries({ queryKey: ['dailyMasterPlan'] })
      queryClient.invalidateQueries({ queryKey: ['agentState'] })
    },
  })

  const justApproved = mutation.isSuccess && mutation.data?.ok
  const effectiveStatus = justApproved ? 'approved' : status
  const reached = reachedIndex(effectiveStatus)
  const planForSummary = approvedPlan ?? pendingPlan
  const alreadyApproved = effectiveStatus === 'approved' || effectiveStatus === 'dispatched'

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* stepper + action */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-5 backdrop-blur-xl">
          <p className="flex items-center gap-2 text-sm font-bold text-civic-white">
            <ShieldCheck className="h-4 w-4 text-btp-cyan" />
            Approval workflow
          </p>
          <p className="mt-1 text-xs text-civic-ivory/55">The agent recommends. The head officer approves.</p>

          {/* stepper */}
          <div className="relative mt-6">
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-civic-white/10" />
            <motion.div
              className="absolute left-4 top-4 h-0.5 bg-btp-cyan"
              initial={{ width: 0 }}
              animate={{ width: `calc(${(reached / (STEPS.length - 1)) * 100}% - ${(reached / (STEPS.length - 1)) * 2}rem)` }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
            <ol className="relative flex justify-between">
              {STEPS.map((label, i) => {
                const filled = i <= reached
                const isCurrent = i === reached
                return (
                  <li key={label} className="flex flex-1 flex-col items-center text-center">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                        filled
                          ? 'border-btp-cyan bg-btp-cyan text-civic-navy'
                          : 'border-civic-white/20 bg-civic-navy text-civic-ivory/45',
                        isCurrent && 'shadow-glow-cyan ring-2 ring-btp-cyan/40',
                      )}
                    >
                      {filled ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={cn('mt-2 max-w-[5rem] text-[10px] font-semibold leading-tight', filled ? 'text-civic-white' : 'text-civic-ivory/45')}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {alreadyApproved ? (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 20 }}
                className="inline-flex items-center gap-2 rounded-xl border border-status-cleared/30 bg-status-cleared/15 px-4 py-2 text-sm font-bold text-status-cleared"
              >
                <CheckCircle2 className="h-4 w-4" />
                Plan approved
              </motion.span>
            ) : (
              <CommandButton
                variant="cyan"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <ShieldCheck className="h-4 w-4" />
                {mutation.isPending ? 'Approving…' : 'Approve Plan'}
              </CommandButton>
            )}

            <button
              type="button"
              disabled
              title="Plan revision editing arrives in a later phase"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-civic-white/12 bg-civic-white/5 px-4 py-2 text-sm font-semibold text-civic-ivory/40"
            >
              <FileEdit className="h-4 w-4" />
              Revise Plan — Phase later
            </button>
          </div>

          {mutation.isError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-status-structural">
              <AlertCircle className="h-3.5 w-3.5" />
              Approval failed — the API is unavailable. Please retry.
            </p>
          )}
          {justApproved && mutation.data?.message && (
            <p className="mt-3 text-xs text-civic-ivory/55">{mutation.data.message}</p>
          )}
        </div>
      </div>

      {/* pending summary */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl border border-status-amber/25 bg-civic-navy/55 p-4 backdrop-blur-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-status-amber">Plan awaiting action</p>
        {planForSummary ? (
          <>
            <p className="mt-1 text-base font-bold text-civic-white">{planForSummary.runId ?? planForSummary.date ?? '—'}</p>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Status" value={effectiveStatus} />
              <Row label="Assignments" value={String(planForSummary.totalAssignments)} />
              <Row label="Stations" value={String(planForSummary.stationSummaries.length)} />
              <Row label="Routing" value={planForSummary.routingMode ?? '—'} />
            </dl>
          </>
        ) : (
          <p className="mt-2 text-xs text-civic-ivory/55">No pending plan to review.</p>
        )}
      </motion.div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-civic-white/5 pb-1.5 last:border-0">
      <dt className="text-civic-ivory/50">{label}</dt>
      <dd className="font-semibold capitalize text-civic-white">{value}</dd>
    </div>
  )
}
