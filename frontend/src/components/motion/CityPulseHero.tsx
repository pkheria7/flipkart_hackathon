import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { scaleIn } from '@/lib/motion'

interface CityPulseHeroProps {
  className?: string
  compact?: boolean
  /** Optional looping video shown behind the SVG signal overlay. */
  videoSrc?: string
  posterSrc?: string
}

type NodeKind = 'structural' | 'responsive' | 'amber' | 'neutral'

interface NetworkNode {
  x: number
  y: number
  kind: NodeKind
  delay: number
}

const LABELS: Array<{ text: string; x: string; y: string; tone: string }> = [
  { text: 'ROI Ranking', x: '6%', y: '10%', tone: 'text-btp-cyan border-btp-cyan/30' },
  { text: 'Patrol Routes', x: '60%', y: '6%', tone: 'text-status-route border-status-route/30' },
  { text: 'Escalation Watch', x: '58%', y: '83%', tone: 'text-status-structural border-status-structural/30' },
  { text: 'Feedback Loop', x: '6%', y: '86%', tone: 'text-status-amber border-status-amber/30' },
]

const NODE_COLOR: Record<NodeKind, string> = {
  structural: '#D62828',
  responsive: '#22D3EE',
  amber: '#F59E0B',
  neutral: '#146C94',
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function CityPulseHero({ className, compact, videoSrc, posterSrc }: CityPulseHeroProps) {
  const [videoOk, setVideoOk] = useState(true)
  // Only load the heavy video on larger screens; mobile falls back to poster/mesh.
  const [allowVideo, setAllowVideo] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setAllowVideo(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const hasVideo = Boolean(videoSrc) && videoOk && allowVideo && !compact

  const nodes = useMemo<NetworkNode[]>(() => {
    const result: NetworkNode[] = []
    // Keep node counts small for performance; fewer when a video already adds depth.
    const count = compact ? 26 : hasVideo ? 34 : 46
    for (let i = 0; i < count; i++) {
      const r1 = seededRandom(i + 1)
      const r2 = seededRandom(i + 100)
      const r3 = seededRandom(i + 200)
      let kind: NodeKind = 'neutral'
      if (r3 < 0.1) kind = 'structural'
      else if (r3 < 0.26) kind = 'responsive'
      else if (r3 < 0.36) kind = 'amber'
      result.push({ x: 6 + r1 * 88, y: 8 + r2 * 84, kind, delay: r1 * 2.5 })
    }
    return result
  }, [compact, hasVideo])

  const edges = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const step = compact ? 3 : 2
    for (let i = 0; i < nodes.length - 1; i += step) {
      const a = nodes[i]
      const b = nodes[Math.min(i + 3, nodes.length - 1)]
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return lines
  }, [nodes, compact])

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-btp-cyan/25 bg-civic-dusk shadow-command',
        compact ? 'min-h-[220px]' : 'min-h-[340px] sm:min-h-[420px]',
        className,
      )}
    >
      {/* Background layer: video (optional) or deep navy mesh */}
      {hasVideo ? (
        <>
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
            onError={() => setVideoOk(false)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <div className="hero-video-scrim" />
        </>
      ) : posterSrc && !compact ? (
        <>
          <img
            src={posterSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-50"
          />
          <div className="hero-video-scrim" />
        </>
      ) : (
        <div className="absolute inset-0 hero-mesh bg-civic-dusk" />
      )}

      {/* subtle grid + aurora orbs (kept light so the video reads cleanly) */}
      <div className={cn('command-grid absolute inset-0', hasVideo ? 'opacity-20' : 'opacity-40')} />
      <div className="aurora-orb -left-10 top-6 h-44 w-44 opacity-60 animate-aurora-drift" />
      <div
        className="aurora-orb right-0 top-1/3 h-32 w-32 opacity-40 animate-aurora-drift"
        style={{
          animationDelay: '-6s',
          background: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)',
        }}
      />

      {/* SVG signal network — ONLY as the no-video fallback (never stacked over video) */}
      {!hasVideo && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <defs>
            <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="60%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="glowF" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="rgba(34,211,238,0.16)"
              strokeWidth="0.12"
            />
          ))}

          {/* glowing curved route beam */}
          <path d="M 8 64 Q 32 30, 54 48 T 92 36" fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="1.4" />
          <motion.path
            d="M 8 64 Q 32 30, 54 48 T 92 36"
            fill="none"
            stroke="url(#routeGrad)"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeDasharray="3 3"
            filter="url(#glowF)"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          />

          {nodes.map((n, i) => (
            <g key={i}>
              {n.kind !== 'neutral' && (
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r={1}
                  fill={NODE_COLOR[n.kind]}
                  opacity={0.25}
                  animate={{ r: [0.8, 2.2, 0.8], opacity: [0.25, 0, 0.25] }}
                  transition={{ duration: n.kind === 'structural' ? 2.2 : 3, repeat: Infinity, delay: n.delay }}
                />
              )}
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.kind === 'neutral' ? 0.32 : 0.55}
                fill={NODE_COLOR[n.kind]}
                filter={n.kind !== 'neutral' ? 'url(#glowF)' : undefined}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: n.kind === 'neutral' ? [0.3, 0.55, 0.3] : [0.7, 1, 0.7] }}
                transition={{ duration: n.kind === 'structural' ? 2 : 3.2, repeat: Infinity, delay: n.delay }}
              />
            </g>
          ))}
        </svg>
      )}

      {/* floating command labels */}
      {!compact &&
        LABELS.map((label, i) => (
          <motion.span
            key={label.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
            className={cn(
              'absolute rounded-full border bg-civic-dusk/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide shadow-command backdrop-blur-sm sm:text-[10px]',
              label.tone,
            )}
            style={{ left: label.x, top: label.y }}
          >
            {label.text}
          </motion.span>
        ))}

      <div className="absolute bottom-3 left-3 right-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-btp-cyan">
          <span className="h-1.5 w-1.5 rounded-full bg-btp-cyan shadow-glow-cyan animate-glow-pulse" />
          Bengaluru Traffic Pulse
        </p>
      </div>
    </motion.div>
  )
}
