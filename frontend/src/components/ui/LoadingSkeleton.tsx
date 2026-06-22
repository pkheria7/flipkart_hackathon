import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface LoadingSkeletonProps {
  className?: string
  lines?: number
}

export function LoadingSkeleton({ className, lines = 3 }: LoadingSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('glass-white space-y-3 p-5', className)}
      aria-busy
      aria-label="Loading"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-lg bg-civic-mist"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </motion.div>
  )
}

export function MetricSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} lines={2} className="!p-4" />
      ))}
    </div>
  )
}
