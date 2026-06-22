import { motion } from 'framer-motion'
import { Mail, ShieldCheck, Truck, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ApiNotification } from '@/types/api'

export const KIND_META: Record<string, { label: string; icon: typeof Mail; chip: string; dot: string }> = {
  head_officer: { label: 'Head Officer', icon: ShieldCheck, chip: 'border-btp-cyan/30 bg-btp-cyan/12 text-btp-cyan', dot: 'bg-btp-cyan' },
  officer: { label: 'Officer', icon: User, chip: 'border-btp-signal/30 bg-btp-signal/12 text-btp-signal', dot: 'bg-btp-signal' },
  tow: { label: 'Tow Truck', icon: Truck, chip: 'border-status-route/30 bg-status-route/12 text-status-route', dot: 'bg-status-route' },
  unknown: { label: 'Other', icon: Mail, chip: 'border-civic-ivory/20 bg-civic-white/5 text-civic-ivory/60', dot: 'bg-civic-ivory/40' },
}

interface NotificationCardProps {
  notification: ApiNotification
  selected?: boolean
  onClick?: () => void
}

export function NotificationCard({ notification, selected, onClick }: NotificationCardProps) {
  const meta = KIND_META[notification.kind] ?? KIND_META.unknown
  const Icon = meta.icon
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
      whileHover={{ y: -2 }}
      className={cn(
        'focus-ring-command flex w-full items-start gap-3 rounded-xl border bg-civic-navy/55 p-3 text-left backdrop-blur-xl transition-colors',
        selected ? 'border-btp-cyan/45 shadow-glow-cyan' : 'border-btp-cyan/12 hover:border-btp-cyan/25',
      )}
    >
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', meta.chip)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('rounded-full border px-1.5 py-0 text-[8px] font-bold uppercase tracking-wide', meta.chip)}>
            {meta.label}
          </span>
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-civic-white">{notification.subject || '(no subject)'}</span>
        <span className="mt-0.5 block truncate text-[11px] text-civic-ivory/50">{notification.recipient || '—'}</span>
      </span>
    </motion.button>
  )
}
