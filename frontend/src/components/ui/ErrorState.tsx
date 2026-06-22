import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { scaleIn } from '@/lib/motion'
import { CommandButton } from './CommandButton'
import { GlassCard } from './GlassCard'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
}

export function ErrorState({
  title = 'Unable to load data',
  description = 'Showing cached or mock data where available.',
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <motion.div variants={scaleIn} initial="hidden" animate="visible">
      <GlassCard className="flex flex-col items-center py-10 text-center" glow="amber">
        <AlertTriangle className="mb-3 h-8 w-8 text-status-amber" />
        <h3 className="text-sm font-semibold text-civic-ink">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-civic-graphite">{description}</p>
        {(onRetry || action) && (
          <div className="mt-4 flex gap-2">
            {onRetry && (
              <CommandButton variant="primary" size="sm" onClick={onRetry}>
                Retry
              </CommandButton>
            )}
            {action}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
