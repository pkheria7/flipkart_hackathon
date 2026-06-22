import type { WorkflowStatus } from '@/types/common'
import { cn } from '@/lib/cn'

interface StatusBadgeProps {
  status: WorkflowStatus
  className?: string
}

const statusStyles: Record<WorkflowStatus, string> = {
  STRUCTURAL: 'bg-status-structural/10 text-status-structural border-status-structural/25',
  RESPONSIVE: 'bg-btp-cyan/10 text-btp-signal border-btp-cyan/25',
  SEASONAL: 'bg-status-seasonal/10 text-status-seasonal border-status-seasonal/25',
  PENDING: 'bg-status-amber/10 text-status-amber border-status-amber/25',
  APPROVED: 'bg-btp-signal/10 text-btp-signal border-btp-signal/25',
  DISPATCHED: 'bg-btp-cyan/10 text-btp-cyan border-btp-cyan/25',
  RECURRENCE: 'bg-status-seasonal/10 text-status-seasonal border-status-seasonal/25',
  CLEARED: 'bg-status-cleared/10 text-status-cleared border-status-cleared/25',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        statusStyles[status],
        className,
      )}
    >
      {status}
    </span>
  )
}
