import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, CheckCircle2, FileStack, ShieldCheck, Truck, User } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { cn } from '@/lib/cn'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { formatStation } from '@/lib/formatters'
import { approveMasterPlan } from '@/services/masterPlanService'
import type { NormalizedPlan } from '@/lib/masterPlan'

interface ApprovalConsoleProps {
  status: string
  dailyPlan: NormalizedPlan | null
  pendingPlan: NormalizedPlan | null
  approvedPlan: NormalizedPlan | null
}

const STEPS = ['Generated', 'Pending Review', 'Approved', 'Dry-run Dispatch']

function reachedIndex(status: string): number {
  switch (status) {
    case 'dispatched': return 3
    case 'approved':   return 2
    case 'pending':
    case 'generated':  return 1
    default:           return 0
  }
}

const CLS_CHIP: Record<string, string> = {
  STRUCTURAL: 'bg-red-500/15 text-red-400',
  RESPONSIVE: 'bg-btp-cyan/15 text-btp-cyan',
  SEASONAL:   'bg-amber-400/15 text-amber-300',
}

export function ApprovalConsole({ status, dailyPlan, pendingPlan, approvedPlan }: ApprovalConsoleProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: approveMasterPlan,
    onSuccess: (data) => {
      if (import.meta.env.DEV) console.log('[ApprovalConsole] approve result:', data)
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
  const planForSummary = approvedPlan ?? pendingPlan ?? dailyPlan
  const alreadyApproved = effectiveStatus === 'approved' || effectiveStatus === 'dispatched'
  const canApprove = !alreadyApproved && (effectiveStatus === 'pending' || effectiveStatus === 'generated')

  const topAssignments = (planForSummary?.assignments ?? []).slice(0, 8)

  useEffect(() => {
    if (import.meta.env.DEV && planForSummary) {
      console.log(
        `[ApprovalConsole] plan loaded — status=${effectiveStatus}`,
        `assignments=${planForSummary.totalAssignments}`,
        `stations=${planForSummary.stationSummaries.length}`,
      )
    }
  }, [planForSummary, effectiveStatus])

  return (
    <div className="space-y-4">

      {/* ── stepper + action ─────────────────────────────────── */}
      <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-5 backdrop-blur-xl">

        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-civic-white">
              <ShieldCheck className="h-4 w-4 text-btp-cyan" />
              Approval workflow
            </p>
            <p className="mt-0.5 text-xs text-civic-ivory/55">
              The agent recommends. The head officer approves.
            </p>
          </div>
          {planForSummary && (
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-status-amber">
                {planForSummary.runId ?? planForSummary.date ?? '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-civic-ivory/55">
                {planForSummary.totalAssignments} assignments · {planForSummary.stationSummaries.length} stations
                {planForSummary.routingMode ? ` · ${planForSummary.routingMode} routing` : ''}
              </p>
            </div>
          )}
        </div>

        {/* stepper */}
        <div className="relative mt-6">
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-civic-white/10" />
          <motion.div
            className="absolute left-4 top-4 h-0.5 bg-btp-cyan"
            initial={{ width: 0 }}
            animate={{
              width: `calc(${(reached / (STEPS.length - 1)) * 100}% - ${(reached / (STEPS.length - 1)) * 2}rem)`,
            }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
          <ol className="relative flex justify-between">
            {STEPS.map((label, i) => {
              const filled = i <= reached
              const isCurrent = i === reached
              return (
                <li key={label} className="flex flex-1 flex-col items-center text-center">
                  <span className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                    filled
                      ? 'border-btp-cyan bg-btp-cyan text-civic-navy'
                      : 'border-civic-white/20 bg-civic-navy text-civic-ivory/45',
                    isCurrent && 'shadow-glow-cyan ring-2 ring-btp-cyan/40',
                  )}>
                    {filled ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn(
                    'mt-2 max-w-[5rem] text-[10px] font-semibold leading-tight',
                    filled ? 'text-civic-white' : 'text-civic-ivory/45',
                  )}>
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        {/* action */}
        <div className="mt-5">
          {alreadyApproved ? (
            <motion.span
              data-testid="approval-status"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 20 }}
              className="inline-flex items-center gap-2 rounded-xl border border-status-cleared/30 bg-status-cleared/15 px-4 py-2 text-sm font-bold text-status-cleared"
            >
              <CheckCircle2 className="h-4 w-4" />
              Plan approved — proceed to Dispatch Preview
            </motion.span>
          ) : canApprove ? (
            <CommandButton
              data-testid="approve-master-plan-button"
              variant="cyan"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              <ShieldCheck className="h-4 w-4" />
              {mutation.isPending ? 'Approving…' : 'Approve Master Plan'}
            </CommandButton>
          ) : (
            <span
              data-testid="approval-status"
              className="inline-flex items-center gap-2 rounded-xl border border-civic-white/10 bg-civic-white/5 px-4 py-2 text-sm text-civic-ivory/50"
            >
              No plan available to approve yet.
            </span>
          )}

          {mutation.isError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-status-structural">
              <AlertCircle className="h-3.5 w-3.5" />
              Approval failed — the API is unavailable. Please retry.
            </p>
          )}
          {justApproved && mutation.data?.message && (
            <p className="mt-2 text-xs text-civic-ivory/55">{mutation.data.message}</p>
          )}
        </div>
      </div>

      {/* ── agent output: station breakdown ──────────────────── */}
      {planForSummary && planForSummary.stationSummaries.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-btp-cyan">
            <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
            Agent — station breakdown ({planForSummary.stationSummaries.length} stations)
          </p>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {planForSummary.stationSummaries.map((s) => (
              <motion.div
                key={s.station}
                variants={fadeUp}
                data-testid="station-breakdown-card"
                className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-3 py-2.5 backdrop-blur-xl"
              >
                <p className="truncate text-xs font-bold text-civic-white">{formatStation(s.station)}</p>
                <p className="mt-1 text-[11px] font-semibold tabular-nums text-civic-ivory/70">
                  {s.count} assignments{s.avgRoi != null ? ` · ROI ${s.avgRoi.toFixed(0)}` : ''}
                </p>
                <div className="mt-1 flex gap-2 text-[10px]">
                  <span className="text-red-400">{s.structural}S</span>
                  <span className="text-btp-cyan">{s.responsive}R</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── agent output: top assignments ─────────────────────── */}
      {topAssignments.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-btp-cyan">
            <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
            Agent — top assignments by ROI (showing {topAssignments.length} of {planForSummary?.totalAssignments})
          </p>
          <div className="overflow-hidden rounded-2xl border border-civic-ink/10 bg-civic-white shadow-soft">
            <div className="divide-y divide-civic-ink/5">
              {topAssignments.map((a, i) => {
                const cls = (a.classification ?? '').toUpperCase()
                return (
                  <div
                    key={`${a.cluster_id}-${i}`}
                    className="px-4 py-3 transition-colors hover:bg-civic-mist/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="rounded-md bg-btp-blue/10 px-2 py-0.5 text-[11px] font-bold text-btp-blue">
                          {a.time_window ?? '—'}
                        </span>
                        <span className="text-sm font-bold text-civic-ink">{a.cluster_id}</span>
                        <span className="text-xs text-civic-graphite">{formatStation(a.station)}</span>
                        {cls && (
                          <span className={cn(
                            'rounded-full px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide',
                            CLS_CHIP[cls] ?? 'bg-gray-100/50 text-gray-500',
                          )}>
                            {cls}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-3 text-[11px]">
                        {a.roi != null && <span className="font-bold text-btp-blue">ROI {a.roi.toFixed(1)}</span>}
                        {a.lcle != null && <span className="text-civic-graphite">LCLE {a.lcle.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-civic-graphite">
                      {a.officer_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-btp-signal" />
                          {a.officer_name}
                        </span>
                      )}
                      {a.tow_truck_id && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-status-route" />
                          {a.tow_truck_id}
                        </span>
                      )}
                    </div>
                    {a.action && (
                      <p className="mt-1 text-xs leading-relaxed text-civic-ink/70">{a.action}</p>
                    )}
                  </div>
                )
              })}
            </div>
            {(planForSummary?.totalAssignments ?? 0) > 8 && (
              <p className="border-t border-civic-ink/10 bg-civic-mist/40 px-4 py-2 text-center text-[11px] text-civic-graphite">
                +{(planForSummary?.totalAssignments ?? 0) - 8} more assignments — see Master Plan tab for full list
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── no plan yet ───────────────────────────────────────── */}
      {!planForSummary && (
        <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-8 text-center">
          <FileStack className="mx-auto mb-3 h-8 w-8 text-btp-cyan/40" />
          <p className="text-sm font-semibold text-civic-white">No plan generated yet</p>
          <p className="mt-1 text-xs text-civic-ivory/55">
            The 4 AM agent run generates a pending plan awaiting head-officer approval.
          </p>
        </div>
      )}
    </div>
  )
}
