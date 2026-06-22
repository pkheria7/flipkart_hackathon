import { cn } from '@/lib/cn'

interface RoiScorePillProps {
  value: number
  className?: string
  showLabel?: boolean
}

/** ROI score chip, tinted by priority tier. */
export function RoiScorePill({ value, className, showLabel = false }: RoiScorePillProps) {
  const tier =
    value >= 80
      ? 'border-btp-cyan/40 bg-btp-cyan/15 text-btp-cyan shadow-glow-cyan'
      : value >= 60
        ? 'border-btp-signal/40 bg-btp-signal/15 text-btp-cyan'
        : 'border-btp-cyan/15 bg-civic-navy/50 text-civic-ivory/70'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums',
        tier,
        className,
      )}
    >
      {showLabel && <span className="text-[8px] font-semibold uppercase tracking-wide opacity-70">ROI</span>}
      {value.toFixed(1)}
    </span>
  )
}
