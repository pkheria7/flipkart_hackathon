import { motion } from 'framer-motion'
import { Check, ClipboardList, FileStack, Send, ShieldCheck, Siren } from 'lucide-react'
import { cn } from '@/lib/cn'

interface OperationsWorkflowStripProps {
  status: string
  className?: string
}

const STEPS = [
  { label: '4 AM Agent Run', icon: ClipboardList },
  { label: 'Master Plan', icon: FileStack },
  { label: 'Head Officer Approval', icon: ShieldCheck },
  { label: 'Dry-run Dispatch', icon: Send },
  { label: 'Field Execution', icon: Siren },
]

function currentIndex(status: string): number {
  switch (status) {
    case 'dispatched':
      return 4
    case 'approved':
      return 3
    case 'pending':
    case 'generated':
      return 2
    default:
      return 0
  }
}

export function OperationsWorkflowStrip({ status, className }: OperationsWorkflowStripProps) {
  const current = currentIndex(status)
  const pendingApproval = (status === 'pending' || status === 'generated') && current === 2
  const fillPct = (current / (STEPS.length - 1)) * 100

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 px-4 py-4 backdrop-blur-xl', className)}>
      <div className="relative">
        {/* connector track */}
        <div className="absolute left-[8%] right-[8%] top-5 h-0.5 bg-civic-white/10" />
        <motion.div
          className={cn('absolute left-[8%] top-5 h-0.5', pendingApproval ? 'bg-status-amber' : 'bg-btp-cyan')}
          initial={{ width: 0 }}
          animate={{ width: `calc(${fillPct}% * 0.84)` }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />

        <ol className="relative flex justify-between">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const done = i < current
            const isCurrent = i === current
            const amber = isCurrent && pendingApproval
            return (
              <li key={step.label} className="flex flex-1 flex-col items-center text-center">
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
                    done && 'border-status-cleared bg-status-cleared/20 text-status-cleared',
                    isCurrent && !amber && 'border-btp-cyan bg-btp-cyan/20 text-btp-cyan shadow-glow-cyan ring-2 ring-btp-cyan/30',
                    amber && 'border-status-amber bg-status-amber/20 text-status-amber shadow-glow-amber ring-2 ring-status-amber/30',
                    !done && !isCurrent && 'border-civic-white/15 bg-civic-navy text-civic-ivory/40',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.span>
                <span
                  className={cn(
                    'mt-2 max-w-[6rem] text-[10px] font-semibold leading-tight sm:text-[11px]',
                    done || isCurrent ? 'text-civic-white' : 'text-civic-ivory/45',
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
