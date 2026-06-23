import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { tabFade } from '@/lib/motion'
import { useTheme } from '@/theme/ThemeProvider'

export interface ModuleTab {
  id: string
  label: string
  content: ReactNode
  testId?: string
}

interface ModuleTabsProps {
  tabs: ModuleTab[]
  defaultTab?: string
  className?: string
  /** Controlled active tab id. When provided, the component becomes controlled. */
  active?: string
  onTabChange?: (id: string) => void
  /** Unique id for the active-pill layout animation (avoids cross-instance conflicts). */
  layoutId?: string
}

export function ModuleTabs({
  tabs,
  defaultTab,
  className,
  active: activeProp,
  onTabChange,
  layoutId = 'module-tab-active',
}: ModuleTabsProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  const [internalActive, setInternalActive] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const active = activeProp ?? internalActive
  const setActive = (id: string) => {
    if (onTabChange) onTabChange(id)
    if (activeProp === undefined) setInternalActive(id)
  }

  return (
    <div className={cn('space-y-5', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-1.5 rounded-2xl p-1.5 backdrop-blur-xl',
          isDark
            ? 'border border-btp-cyan/12 bg-civic-navy/55'
            : 'border border-[var(--glass-border-accent)] bg-[var(--glass-navy-bg)]',
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={tab.testId}
            onClick={() => setActive(tab.id)}
            className={cn(
              'focus-ring-command relative rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              isDark
                ? active === tab.id
                  ? 'text-civic-white'
                  : 'text-civic-ivory/55 hover:text-civic-white'
                : active === tab.id
                  ? 'text-on-primary'
                  : 'text-shell-muted hover:text-shell',
            )}
          >
            {active === tab.id && (
              <motion.span
                layoutId={layoutId}
                className={cn(
                  'absolute inset-0 rounded-xl shadow-glow-cyan ring-1',
                  isDark
                    ? 'bg-btp-blue/80 ring-btp-cyan/30'
                    : 'bg-[color-mix(in_srgb,var(--btp-blue)_80%,transparent)] ring-[var(--glass-border-accent)]',
                )}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          variants={tabFade}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {tabs.find((t) => t.id === active)?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
