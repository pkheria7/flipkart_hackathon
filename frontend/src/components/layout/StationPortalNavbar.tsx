import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { CommandButton } from '@/components/ui/CommandButton'
import { ThemeSelector } from '@/components/layout/ThemeSelector'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { useTheme } from '@/theme/ThemeProvider'

interface StationPortalNavbarProps {
  stationLabel?: string
  displayName?: string | null
  onLogout?: () => void
  /** Dashboard shows logout; detail shows back-to-portal */
  variant?: 'dashboard' | 'detail'
}

export function StationPortalNavbar({
  stationLabel,
  displayName,
  onLogout,
  variant = 'dashboard',
}: StationPortalNavbarProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark

  return (
    <header
      className={cn('app-navbar sticky top-0 z-30 border-b backdrop-blur-2xl')}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo size={32} />
          <div className="min-w-0 leading-tight">
            <p className={cn('truncate text-sm font-bold', isDark ? 'text-civic-white' : 'text-shell')}>
              {APP_NAME}
            </p>
            <p
              className={cn(
                'truncate text-[10px] font-semibold',
                isDark ? 'text-btp-cyan' : 'text-[var(--color-accent)]',
              )}
            >
              {stationLabel ? `${stationLabel} · Station Portal` : 'Station Portal'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {displayName && (
            <span className="hidden text-xs font-medium text-shell-muted sm:inline">{displayName}</span>
          )}
          <ThemeSelector compact />
          {variant === 'detail' ? (
            <Link to="/station-dashboard">
              <CommandButton variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Portal</span>
              </CommandButton>
            </Link>
          ) : (
            onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={cn(
                  'focus-ring-command inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  isDark
                    ? 'border-btp-cyan/20 bg-civic-navy/60 text-shell hover:border-status-structural/40 hover:text-status-structural'
                    : 'border-[var(--glass-border)] bg-[var(--color-bg-muted)] text-shell hover:border-status-structural/40 hover:text-status-structural',
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  )
}
