import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { APP_NAME, APP_SUBTITLE } from '@/lib/constants'
import { useApiHealth } from '@/hooks/useApiHealth'
import { useTheme } from '@/theme/ThemeProvider'
import { useAuth } from '@/auth/AuthProvider'
import { ThemeSelector } from '@/components/layout/ThemeSelector'
import { cn } from '@/lib/cn'

interface TopbarProps {
  onMenuClick?: () => void
}

const statusStyles = {
  connected: 'bg-status-cleared/15 text-status-cleared ring-status-cleared/30',
  'mock-mode': 'bg-status-amber/15 text-status-amber ring-status-amber/30',
  fallback: 'bg-status-amber/15 text-status-amber ring-status-amber/30',
  offline: 'bg-status-structural/15 text-status-structural ring-status-structural/30',
}

const statusDot = {
  connected: 'bg-status-cleared',
  'mock-mode': 'bg-status-amber',
  fallback: 'bg-status-amber',
  offline: 'bg-status-structural',
}

const MODULE_TITLES: Record<string, string> = {
  '/command': 'Command Center',
  '/intelligence': 'Hotspot Intelligence',
  '/operations': 'Patrol Operations',
  '/feedback-escalation': 'Feedback & Escalation',
  '/impact': 'Enforcement Impact',
  '/demo': 'Demo Mode',
  '/priority': 'Priority Board',
  '/map': 'City Map',
  '/routes': 'Patrol Routes',
  '/master-plan': 'Master Plan',
  '/approval': 'Approval Console',
  '/notifications': 'Notifications',
  '/officer': 'Officer View',
  '/tow': 'Tow View',
  '/feedback': 'Feedback',
  '/escalation': 'Escalation',
  '/week-comparison': 'Week Comparison',
  '/run-logs': 'Run Logs',
  '/reports': 'Reports',
}

function resolveModuleTitle(pathname: string): string {
  if (pathname.startsWith('/hotspots/')) return 'Hotspot Detail'
  return MODULE_TITLES[pathname] ?? 'Command Module'
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { status, label } = useApiHealth()
  const { themeDefinition } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark = themeDefinition.isDark
  const moduleTitle = resolveModuleTitle(location.pathname)

  const onLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="app-navbar sticky top-0 z-30 border-b backdrop-blur-2xl">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className={cn(
              'focus-ring-command rounded-lg p-2 lg:hidden',
              isDark
                ? 'text-civic-ivory/70 hover:bg-civic-white/5 hover:text-civic-white'
                : 'text-shell-muted hover:bg-[var(--color-bg-muted)] hover:text-shell',
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            {/* Mobile: brand when sidebar is hidden */}
            <div className="lg:hidden">
              <h1 className={cn('truncate text-sm font-bold', isDark ? 'text-civic-white' : 'text-shell')}>
                {APP_NAME}
              </h1>
              <p
                className={cn(
                  'hidden truncate text-[11px] sm:block',
                  isDark ? 'text-civic-ivory/55' : 'text-shell-muted',
                )}
              >
                {APP_SUBTITLE}
              </p>
            </div>
            {/* Desktop: current module — brand lives in sidebar only */}
            <div className="hidden lg:block">
              <h1 className={cn('truncate text-sm font-bold', isDark ? 'text-civic-white' : 'text-shell')}>
                {moduleTitle}
              </h1>
              <p
                className={cn(
                  'truncate text-[11px]',
                  isDark ? 'text-civic-ivory/55' : 'text-shell-muted',
                )}
              >
                {APP_SUBTITLE}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeSelector />
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1',
              statusStyles[status],
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', statusDot[status])} />
            {label}
          </motion.span>
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              'focus-ring-command inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
              isDark
                ? 'border-btp-cyan/15 bg-civic-navy/60 text-civic-ivory/80 hover:border-status-structural/40 hover:text-status-structural'
                : 'border-[var(--glass-border)] bg-[var(--color-bg-muted)] text-shell hover:border-status-structural/40 hover:text-status-structural',
            )}
            aria-label="Log out"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      <div
        className={cn(
          'hidden items-center gap-2 px-6 py-1.5 md:flex',
          isDark ? 'border-t border-btp-cyan/8 bg-civic-navy/40' : 'border-t border-[var(--color-border)] bg-[var(--color-bg-muted)]',
        )}
      >
        <span
          className={cn(
            'h-1 w-1 rounded-full shadow-glow-cyan',
            isDark ? 'bg-btp-cyan' : 'bg-[var(--color-accent)]',
          )}
        />
        <p className={cn('text-[10px] font-medium tracking-wide', isDark ? 'text-civic-ivory/50' : 'text-shell-muted')}>
          Human-in-loop enforcement workflow · ROI-ranked hotspots · Dry-run dispatch
        </p>
      </div>
    </header>
  )
}
