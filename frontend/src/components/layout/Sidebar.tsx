import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  LayoutDashboard,
  Map,
  MessagesSquare,
  Play,
  Route,
  TrendingUp,
  X,
} from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { useTheme } from '@/theme/ThemeProvider'
import { BrandLogo } from '@/components/ui/BrandLogo'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { label: 'Mission Brief', to: '/mission', icon: BookOpen },
  { label: 'Command Center', to: '/command', icon: LayoutDashboard },
  { label: 'Hotspot Intelligence', to: '/intelligence', icon: Map },
  { label: 'Patrol Operations', to: '/operations', icon: Route },
  { label: 'Feedback & Escalation', to: '/feedback-escalation', icon: MessagesSquare },
  { label: 'Enforcement Impact', to: '/impact', icon: TrendingUp },
  { label: 'Demo Mode', to: '/demo', icon: Play },
]

interface SidebarProps {
  collapsed?: boolean
  mobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col backdrop-blur-2xl transition-transform duration-300',
        'w-64 shadow-command',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed && 'lg:w-[4.5rem]',
        'fixed inset-y-0 left-0 z-40 lg:static',
        isDark
          ? 'border-r border-btp-cyan/12 bg-civic-navy/85'
          : 'border-r border-[var(--glass-border)] bg-[var(--color-surface)]',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent',
          isDark ? 'from-btp-cyan/8' : 'from-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]',
        )}
      />

      <div
        className={cn(
          'relative flex items-center justify-between px-5 py-4',
          isDark ? 'border-b border-btp-cyan/10' : 'border-b border-[var(--color-border)]',
        )}
      >
        <div className={cn('flex items-center gap-2.5', collapsed && 'lg:w-full lg:justify-center')}>
          <BrandLogo size={36} />
          {!collapsed && (
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-bold', isDark ? 'text-civic-white' : 'text-shell')}>
                {APP_NAME}
              </p>
              <p
                className={cn(
                  'truncate text-[9px] font-semibold uppercase tracking-[0.14em]',
                  isDark ? 'text-btp-cyan' : 'text-[var(--color-accent)]',
                )}
              >
                {isDark ? 'Aurora Command · Dusk' : themeDefinition.name}
              </p>
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'focus-ring-command rounded-lg p-1 lg:hidden',
              isDark
                ? 'text-civic-white/70 hover:text-civic-white'
                : 'text-shell-muted hover:text-shell',
            )}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/mission'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'group focus-ring-command relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    collapsed && 'lg:justify-center lg:px-2',
                    isDark
                      ? isActive
                        ? 'bg-btp-blue/30 text-civic-white shadow-glow-cyan ring-1 ring-btp-cyan/30'
                        : 'text-civic-ivory/65 hover:bg-civic-white/5 hover:text-civic-white'
                      : isActive
                        ? 'bg-[color-mix(in_srgb,var(--btp-blue)_12%,transparent)] text-shell shadow-soft ring-1 ring-[var(--glass-border-accent)]'
                        : 'text-shell-muted hover:bg-[var(--color-bg-muted)] hover:text-shell',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        className={cn(
                          'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full shadow-glow-cyan',
                          isDark ? 'bg-btp-cyan' : 'bg-[var(--color-accent)]',
                        )}
                      />
                    )}
                    <motion.span whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isDark
                            ? isActive
                              ? 'text-btp-cyan'
                              : 'text-civic-ivory/55 group-hover:text-btp-cyan'
                            : isActive
                              ? 'text-[var(--color-accent)]'
                              : 'text-shell-muted group-hover:text-[var(--color-accent)]',
                        )}
                      />
                    </motion.span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {!collapsed && (
        <div
          className={cn(
            'relative hidden px-5 py-4 lg:block',
            isDark ? 'border-t border-btp-cyan/10' : 'border-t border-[var(--color-border)]',
          )}
        >
          <p
            className={cn(
              'flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider',
              isDark ? 'text-btp-cyan' : 'text-[var(--color-accent)]',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full shadow-glow-cyan',
                isDark ? 'bg-btp-cyan' : 'bg-[var(--color-accent)]',
              )}
            />
            ROI-first enforcement
          </p>
          <p className={cn('mt-1 text-[10px]', isDark ? 'text-civic-ivory/50' : 'text-shell-muted')}>
            Human-in-loop
          </p>
        </div>
      )}
    </aside>
  )
}
