import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type GlassVariant = 'white' | 'navy' | 'signal'

interface GlassCardProps {
  children: ReactNode
  className?: string
  variant?: GlassVariant
  glow?: 'cyan' | 'amber' | 'red' | false
}

const variantClass: Record<GlassVariant, string> = {
  white: 'glass-white',
  navy: 'glass-navy',
  signal:
    'rounded-2xl border border-btp-cyan/30 bg-civic-mist/92 text-civic-ink shadow-soft',
}

const glowClass = {
  cyan: 'shadow-glow-cyan',
  amber: 'shadow-glow-amber',
  red: 'shadow-glow-red',
}

export function GlassCard({
  children,
  className,
  variant = 'white',
  glow = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'p-5',
        variantClass[variant],
        glow && glowClass[glow],
        className,
      )}
    >
      {children}
    </div>
  )
}
