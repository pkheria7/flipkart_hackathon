import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HERO_VIDEO, HERO_VIDEO_POSTER } from '@/lib/brand'
import { BrandLockup } from '@/components/brand/BrandLockup'
import { cn } from '@/lib/cn'
import { scaleIn } from '@/lib/motion'

interface HeroVideoPanelProps {
  className?: string
  compact?: boolean
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

function useIsMobileVideo() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

export function HeroVideoPanel({ className, compact }: HeroVideoPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobileVideo()
  const showVideo = !prefersReducedMotion && !isMobile

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-btp-cyan/25 bg-civic-navy shadow-command ring-1 ring-btp-cyan/10',
        compact ? 'min-h-[220px]' : 'min-h-[280px] sm:min-h-[380px] lg:min-h-[420px]',
        className,
      )}
    >
      {showVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_VIDEO_POSTER}
          aria-label="GridLock network pulse preview"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      ) : (
        <img
          src={HERO_VIDEO_POSTER}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-civic-navy/85 via-civic-navy/55 to-btp-blue/35" />
      <div className="aurora-orb -left-8 top-8 h-36 w-36 opacity-50" />
      <div
        className="aurora-orb right-8 top-1/4 h-28 w-28 opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.12),transparent_55%)]" />

      {/* Bottom-right mask — covers Gemini watermark zone */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-44 bg-gradient-to-tl from-civic-navy via-civic-navy/95 to-transparent" />

      {!compact && (
        <>
          <span className="absolute left-4 top-4 rounded-full border border-civic-white/10 bg-civic-navy/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-btp-cyan backdrop-blur-sm sm:text-[10px]">
            Live Signal Preview
          </span>
          <span className="absolute right-4 top-4 hidden rounded-full border border-status-route/20 bg-civic-navy/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-status-route backdrop-blur-sm sm:inline-flex">
            ROI Network Active
          </span>
        </>
      )}

      <div className="absolute bottom-3 right-3 z-10 max-w-[calc(100%-1.5rem)]">
        <div className="flex items-center gap-2.5 rounded-xl border border-btp-cyan/25 bg-civic-navy/90 px-3 py-2 shadow-command backdrop-blur-md">
          <BrandLockup variant="chip" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold leading-tight text-civic-white">
              GridLock Command
            </p>
            <p className="truncate text-[9px] font-medium uppercase tracking-wider text-btp-cyan">
              Traffic Pulse Preview
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-10">
        <p className="text-[10px] font-medium uppercase tracking-widest text-btp-cyan/80">
          Bengaluru Traffic Pulse
        </p>
      </div>
    </motion.div>
  )
}
