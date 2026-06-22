import { useState } from 'react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/cn'

const LOGO_SRC = '/brand/gridlock-logo.png'

interface BrandLogoProps {
  size?: number
  className?: string
  rounded?: boolean
}

/**
 * Brand mark for GridLock Command.
 * Uses the generated shield logo from /public/brand when available and
 * gracefully falls back to the Shield icon so the layout never breaks.
 */
export function BrandLogo({ size = 36, className, rounded = true }: BrandLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={cn(
          'flex items-center justify-center bg-btp-blue shadow-glow-cyan',
          rounded ? 'rounded-xl' : 'rounded-md',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Shield className="text-civic-white" style={{ width: size * 0.5, height: size * 0.5 }} />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-civic-ivory ring-1 ring-btp-cyan/30 shadow-glow-cyan',
        rounded ? 'rounded-xl' : 'rounded-md',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_SRC}
        alt="GridLock Command logo"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
