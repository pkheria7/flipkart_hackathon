import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Mail, Send, ShieldOff } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { staggerContainer } from '@/lib/motion'
import { dispatchApprovedPlan } from '@/services/masterPlanService'
import type { ApiNotification } from '@/types/api'
import type { PlanAssignment } from '@/lib/masterPlan'
import { NotificationCard, KIND_META } from './NotificationCard'
import { MobileAssignmentPreview } from './MobileAssignmentPreview'

interface DispatchPreviewProps {
  notifications: ApiNotification[]
  notifLoading?: boolean
  firstAssignment?: PlanAssignment | null
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'head_officer', label: 'Head Officer' },
  { id: 'officer', label: 'Officer' },
  { id: 'tow', label: 'Tow Truck' },
]

function dispatchCount(data: unknown): number | null {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const k of ['eml_count', 'count', 'emails_generated', 'total']) {
      if (typeof d[k] === 'number') return d[k] as number
    }
  }
  return null
}

export function DispatchPreview({ notifications, notifLoading, firstAssignment }: DispatchPreviewProps) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: dispatchApprovedPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['agentState'] })
    },
  })

  const filtered = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((n) => n.kind === filter)),
    [notifications, filter],
  )

  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null
  const dispatchedCount = mutation.isSuccess ? dispatchCount(mutation.data?.data) ?? notifications.length : null

  return (
    <div className="space-y-4">
      {/* action bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-civic-white">
            <Send className="h-4 w-4 text-btp-cyan" />
            Dry-run dispatch
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-civic-ivory/55">
            <ShieldOff className="h-3 w-3" />
            Generates .eml previews only — no real SMTP is sent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mutation.isSuccess && (
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 18 }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-status-cleared/30 bg-status-cleared/15 px-3 py-1.5 text-xs font-bold text-status-cleared"
            >
              <CheckCircle2 className="h-4 w-4" />
              {dispatchedCount != null ? `${dispatchedCount} emails generated` : 'Dispatch complete'}
            </motion.span>
          )}
          <CommandButton variant="cyan" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Send className="h-4 w-4" />
            {mutation.isPending ? 'Dispatching…' : 'Run Dry-run Dispatch'}
          </CommandButton>
        </div>
      </div>

      {mutation.isError && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-status-structural">
          <AlertCircle className="h-3.5 w-3.5" />
          Dispatch failed — the API is unavailable. Please retry.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* notifications list */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = f.id === 'all' ? notifications.length : notifications.filter((n) => n.kind === f.id).length
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'focus-ring-command rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
                    filter === f.id
                      ? 'border-btp-cyan/40 bg-btp-cyan/15 text-btp-cyan'
                      : 'border-btp-cyan/12 bg-civic-navy/55 text-civic-ivory/55 hover:text-civic-white',
                  )}
                >
                  {f.label}
                  <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {notifLoading ? (
            <LoadingSkeleton lines={4} />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-8 text-center">
              <Mail className="mx-auto mb-2 h-7 w-7 text-btp-cyan/50" />
              <p className="text-sm font-semibold text-civic-white">No notifications yet</p>
              <p className="mt-1 text-xs text-civic-ivory/55">Run a dry-run dispatch to generate notification previews.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="max-h-[clamp(300px,42vh,520px)] space-y-2 overflow-y-auto pr-1 scrollbar-thin"
              >
                {filtered.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    selected={selected?.id === n.id}
                    onClick={() => setSelectedId(n.id)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* preview + mobile */}
        <div className="space-y-4">
          {selected ? (
            <PreviewCard notification={selected} />
          ) : (
            <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-8 text-center text-xs text-civic-ivory/55">
              Select a notification to preview its content.
            </div>
          )}
          <MobileAssignmentPreview assignment={firstAssignment ?? undefined} notification={selected ?? undefined} />
        </div>
      </div>
    </div>
  )
}

function PreviewCard({ notification }: { notification: ApiNotification }) {
  const meta = KIND_META[notification.kind] ?? KIND_META.unknown
  const Icon = meta.icon
  return (
    <motion.article
      key={notification.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-civic-ink/10 bg-civic-white shadow-soft"
    >
      <header className="flex items-center justify-between border-b border-civic-ink/10 bg-civic-mist/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-civic-ink">{notification.subject || '(no subject)'}</p>
          <p className="truncate text-xs text-civic-graphite">To: {notification.recipient || '—'}</p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.chip)}>
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </header>
      <div className="max-h-[clamp(200px,30vh,360px)] overflow-y-auto px-4 py-3 scrollbar-thin">
        <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-civic-ink/85">
          {notification.body || 'No content available.'}
        </pre>
      </div>
    </motion.article>
  )
}
