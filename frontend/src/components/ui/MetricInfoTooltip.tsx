import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'

interface MetricInfoTooltipProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function MetricInfoTooltip({ label, children, className }: MetricInfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent | FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('focusin', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('focusin', close)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-current opacity-50 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-btp-cyan"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl border border-btp-cyan/20 bg-[var(--color-surface-glass)] p-3 text-left text-xs leading-relaxed text-shell shadow-command backdrop-blur-xl"
        >
          <p className="font-semibold text-shell">{label}</p>
          <p className="mt-1 text-shell-muted">{children}</p>
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-btp-cyan/20 bg-[var(--color-surface-glass)]" />
        </div>
      )}
    </div>
  )
}
