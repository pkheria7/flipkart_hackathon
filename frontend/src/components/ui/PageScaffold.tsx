import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { useTheme } from '@/theme/ThemeProvider'
import { cn } from '@/lib/cn'

interface PageScaffoldProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  children?: ReactNode
}

export function PageScaffold({
  title,
  description,
  eyebrow,
  actions,
  children,
}: PageScaffoldProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible">
      <div
        className={cn(
          'mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between',
          isDark ? 'border-btp-cyan/12' : 'border-[var(--color-border)]',
        )}
      >
        <div className="min-w-0">
          {eyebrow && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]',
                isDark ? 'text-btp-cyan' : 'text-[var(--color-accent)]',
              )}
            >
              <span
                className={cn(
                  'h-1 w-1 rounded-full shadow-glow-cyan',
                  isDark ? 'bg-btp-cyan' : 'bg-[var(--color-accent)]',
                )}
              />
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              'mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl',
              isDark ? 'text-civic-white' : 'text-shell',
            )}
          >
            {title}
          </h1>
          {description && (
            <p
              className={cn(
                'mt-2 max-w-3xl text-sm leading-relaxed',
                isDark ? 'text-civic-ivory/65' : 'text-shell-muted',
              )}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </motion.div>
  )
}
