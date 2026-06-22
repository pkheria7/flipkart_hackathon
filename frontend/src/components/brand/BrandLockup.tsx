import { useState } from 'react'
import { Shield } from 'lucide-react'
import { APP_NAME, APP_SUBTITLE } from '@/lib/constants'
import { BRAND_LOGO, BRAND_LOGO_MARK } from '@/lib/brand'
import { cn } from '@/lib/cn'

type BrandLockupVariant = 'hero' | 'sidebar' | 'topbar' | 'mark' | 'chip'

interface BrandLockupProps {
  variant?: BrandLockupVariant
  title?: string
  subtitle?: string
  className?: string
  onDark?: boolean
}

const logoSizes: Record<BrandLockupVariant, string> = {
  hero: 'h-14 w-14 sm:h-16 sm:w-16',
  sidebar: 'h-8 w-8',
  topbar: 'h-7 w-7',
  mark: 'h-6 w-6',
  chip: 'h-5 w-5',
}

export function BrandLockup({
  variant = 'sidebar',
  title = APP_NAME,
  subtitle,
  className,
  onDark = false,
}: BrandLockupProps) {
  const [logoFailed, setLogoFailed] = useState(false)
  const src = variant === 'mark' || variant === 'chip' || variant === 'topbar'
    ? BRAND_LOGO_MARK
    : BRAND_LOGO

  const resolvedSubtitle =
    subtitle ??
    (variant === 'sidebar'
      ? 'BTP Command'
      : variant === 'hero'
        ? APP_SUBTITLE
        : undefined)

  const logo = logoFailed ? (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-btp-blue shadow-soft',
        logoSizes[variant],
        variant === 'hero' && 'rounded-2xl',
      )}
    >
      <Shield
        className={cn(
          'text-civic-white',
          variant === 'hero' ? 'h-7 w-7' : variant === 'sidebar' ? 'h-4 w-4' : 'h-3.5 w-3.5',
        )}
      />
    </div>
  ) : (
    <img
      src={src}
      alt=""
      aria-hidden
      onError={() => setLogoFailed(true)}
      className={cn('shrink-0 object-contain drop-shadow-sm', logoSizes[variant])}
    />
  )

  if (variant === 'mark' || variant === 'chip') {
    return <div className={className}>{logo}</div>
  }

  if (variant === 'topbar') {
    return (
      <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
        {logo}
        <div className="min-w-0 hidden sm:block">
          <p
            className={cn(
              'truncate text-sm font-bold',
              onDark ? 'text-civic-white' : 'text-civic-ink',
            )}
          >
            {title}
          </p>
        </div>
      </div>
    )
  }

  const titleClass =
    variant === 'hero'
      ? 'font-display text-3xl font-bold tracking-tight text-civic-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight'
      : 'truncate text-sm font-bold text-civic-ink'

  const subtitleClass =
    variant === 'hero'
      ? 'mt-1 max-w-xl text-sm font-medium text-btp-cyan/90 sm:text-base'
      : 'truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-btp-cyan'

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        variant === 'hero' && 'flex-col items-start gap-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      {logo}
      <div className="min-w-0">
        <p className={titleClass}>{title}</p>
        {resolvedSubtitle && <p className={subtitleClass}>{resolvedSubtitle}</p>}
      </div>
    </div>
  )
}
