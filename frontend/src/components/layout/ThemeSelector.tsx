import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/theme/ThemeProvider'
import { toggleThemeId } from '@/theme/themes'

interface ThemeSelectorProps {
  className?: string
  /** Hide text label on very narrow viewports */
  compact?: boolean
}

const THUMB_OFFSET = 32

export function ThemeSelector({ className, compact }: ThemeSelectorProps) {
  const { theme, themeDefinition, setTheme } = useTheme()
  const isDark = themeDefinition.isDark

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={!isDark}
        aria-label={`Visual theme: ${themeDefinition.shortLabel}. Switch to ${isDark ? 'Bengaluru Daylight' : 'Aurora Dusk'}.`}
        onClick={() => setTheme(toggleThemeId(theme))}
        className="focus-ring-command relative inline-flex h-9 w-[4.5rem] shrink-0 items-center rounded-full border border-[var(--glass-border)] bg-[var(--color-bg-muted)] p-1 transition-colors hover:border-[var(--color-accent)]"
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className="pointer-events-none absolute top-1 left-1 h-7 w-7 rounded-full bg-[var(--color-surface)] shadow-sm ring-1 ring-[var(--glass-border)]"
          animate={{ x: isDark ? 0 : THUMB_OFFSET }}
        />
        <span
          className={cn(
            'relative z-10 flex flex-1 items-center justify-center transition-colors',
            isDark ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]',
          )}
          aria-hidden
        >
          <Moon className="h-3.5 w-3.5" />
        </span>
        <span
          className={cn(
            'relative z-10 flex flex-1 items-center justify-center transition-colors',
            !isDark ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]',
          )}
          aria-hidden
        >
          <Sun className="h-3.5 w-3.5" />
        </span>
      </button>
      {!compact && (
        <span className="hidden text-xs font-semibold text-shell sm:inline">
          {themeDefinition.shortLabel}
        </span>
      )}
    </div>
  )
}
