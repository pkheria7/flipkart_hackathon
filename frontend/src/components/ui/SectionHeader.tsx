import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  eyebrow?: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({
  title,
  eyebrow,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-btp-blue/80">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-bold text-civic-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-civic-graphite">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
