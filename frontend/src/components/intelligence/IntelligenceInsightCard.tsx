import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type InsightTone = 'cyan' | 'amber' | 'structural' | 'seasonal'

interface IntelligenceInsightCardProps {
  icon?: LucideIcon
  title: string
  children: React.ReactNode
  tone?: InsightTone
  className?: string
}

const TONE: Record<InsightTone, { chip: string; ring: string }> = {
  cyan: { chip: 'bg-btp-cyan/15 text-btp-cyan', ring: 'border-btp-cyan/20' },
  amber: { chip: 'bg-status-amber/15 text-status-amber', ring: 'border-status-amber/20' },
  structural: { chip: 'bg-status-structural/15 text-status-structural', ring: 'border-status-structural/25' },
  seasonal: { chip: 'bg-status-seasonal/15 text-status-seasonal', ring: 'border-status-seasonal/20' },
}

export function IntelligenceInsightCard({
  icon: Icon,
  title,
  children,
  tone = 'cyan',
  className,
}: IntelligenceInsightCardProps) {
  const t = TONE[tone]
  return (
    <div
      className={cn(
        'rounded-2xl border bg-civic-navy/55 p-4 backdrop-blur-xl',
        t.ring,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', t.chip)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <p className="text-sm font-bold text-civic-white">{title}</p>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-civic-ivory/65">{children}</div>
    </div>
  )
}
