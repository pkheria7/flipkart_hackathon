import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { SnapshotMetric } from '@/components/home/MotionMetricCard'
import { MotionMetricCard } from '@/components/home/MotionMetricCard'
import { MetricSkeletonRow } from '@/components/ui/LoadingSkeleton'
import { prefersReducedMotion, staggerContainer, viewportOnce } from '@/lib/motion'

interface OperationalSnapshotSectionProps {
  metrics: SnapshotMetric[]
  isLoading: boolean
}
function SnapshotSignalBackground() {
  const reduced = prefersReducedMotion()

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="command-grid absolute inset-0 opacity-[0.07]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(34,211,238,0.06),transparent_65%)]" />

      {/* Static radar rings — no motion */}
      <svg
        viewBox="0 0 400 400"
        className="absolute -right-24 -top-24 h-[420px] w-[420px] opacity-[0.05]"
        aria-hidden
      >
        <circle cx="200" cy="200" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btp-cyan" />
        <circle cx="200" cy="200" r="120" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btp-cyan" />
        <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btp-cyan" />
        <line x1="200" y1="200" x2="200" y2="20" stroke="currentColor" strokeWidth="0.5" className="text-btp-cyan/70" />
      </svg>

      {/* Very slow radar sweep — disabled when reduced motion */}
      {!reduced && (
        <motion.div
          className="absolute -right-32 top-1/2 h-[520px] w-[520px] -translate-y-1/2 opacity-[0.04]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.35) 28deg, transparent 56deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

export function OperationalSnapshotSection({
  metrics,
  isLoading,
}: OperationalSnapshotSectionProps) {  const reduced = prefersReducedMotion()

  const sectionVariants = useMemo(
    () =>
      reduced
        ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
        : {
            hidden: { opacity: 0, y: 32 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
          },
    [reduced],
  )

  const cardStagger = useMemo(
    () =>
      reduced
        ? staggerContainer
        : {
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
          },
    [reduced],
  )

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={sectionVariants}
      className="relative z-10 border-y border-btp-cyan/10 bg-civic-dusk/60 py-12 sm:py-14"
    >
      <SnapshotSignalBackground />

      <div className="page-container relative">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-btp-cyan">
            <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
            Live command snapshot
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-civic-white sm:text-[1.65rem]">
            Today&apos;s operational picture
          </h2>
        </div>
        {isLoading ? (
          <div className="mt-7">
            <MetricSkeletonRow count={5} />
          </div>
        ) : (
          <motion.div
            variants={cardStagger}
            className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            {metrics.map((metric) => (
              <MotionMetricCard key={metric.id} metric={metric} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}
