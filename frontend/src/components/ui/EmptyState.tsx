import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { scaleIn } from '@/lib/motion'
import { GlassCard } from './GlassCard'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div variants={scaleIn} initial="hidden" animate="visible">
      <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="mb-3 h-8 w-8 text-civic-mist" />
        <h3 className="text-sm font-semibold text-civic-ink">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-civic-graphite">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </GlassCard>
    </motion.div>
  )
}
