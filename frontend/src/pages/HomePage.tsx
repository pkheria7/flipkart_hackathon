import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, ExternalLink, Play, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { ThemeSelector } from '@/components/layout/ThemeSelector'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { HomeVideoBackground } from '@/components/home/HomeVideoBackground'
import { TypewriterText } from '@/components/home/TypewriterText'
import { useTheme } from '@/theme/ThemeProvider'
import { fadeUp, staggerContainer, prefersReducedMotion } from '@/lib/motion'

const TITLE = 'GridLock Command'
const TITLE_ACCENT_FROM = 'GridLock '.length
const SUBTITLE = 'Parking Impact Intelligence for Bengaluru Traffic Police'
const DESCRIPTION =
  'Convert FTVR violation records into ROI-ranked hotspots, patrol routes, and escalation briefs.'
const TRUST_ROW = ['BTP-oriented workflow', 'Station-wise enforcement', 'Human-in-loop review']

/** Public demo walkthrough — env override optional; always works on fresh clone. */
const DEMO_VIDEO_FALLBACK = 'https://www.youtube.com/watch?v=7PjWqOnLzUs&t=31s'
const DEMO_VIDEO_URL = import.meta.env.VITE_DEMO_VIDEO_URL || DEMO_VIDEO_FALLBACK

interface EntryCard {
  title: string
  subtitle: string
  cta: string
  to: string
  icon: LucideIcon
  accent: 'cyan' | 'amber'
}

const ENTRY_CARDS: EntryCard[] = [
  {
    title: 'Admin Command Center',
    subtitle:
      'Full access to hotspots, patrol planning, feedback loops, and enforcement impact.',
    cta: 'Login as Admin',
    to: '/login/admin',
    icon: ShieldCheck,
    accent: 'cyan',
  },
  {
    title: 'Traffic Station Portal',
    subtitle: 'Station-specific hotspots, patrol priorities, and escalation review.',
    cta: 'Login as Traffic Station',
    to: '/login/station',
    icon: Building2,
    accent: 'amber',
  },
]

export function HomePage() {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  const reduced = prefersReducedMotion()

  // Sequenced typing: badge → title → subtitle → description → bullets.
  const [step, setStep] = useState(0)
  const advance = (n: number) => setStep((s) => Math.max(s, n))
  const bulletsVisible = reduced || step >= 4

  const accentText = isDark ? 'text-cyan-300' : 'text-amber-300'
  const accentDot = isDark ? 'bg-cyan-300' : 'bg-amber-300'
  const accentCursor = isDark ? 'bg-cyan-300' : 'bg-amber-300'
  const badgeChip = isDark
    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
    : 'border-amber-400/45 bg-amber-400/15 text-amber-200'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <HomeVideoBackground />

      {/* Navbar */}
      <header className="relative z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={38} />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{APP_NAME}</p>
              <p className={`font-mono text-[9px] font-semibold uppercase tracking-[0.16em] ${accentText}`}>
                Parking Impact Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-semibold text-white/85 backdrop-blur sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              System demo
            </span>
            <ThemeSelector compact />
          </div>
        </div>
      </header>

      {/* Hero + entry */}
      <main className="relative z-10">
        <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-16">
          {/* Left: hero copy (typed) */}
          <div>
            {/* Badge */}
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest backdrop-blur ${badgeChip}`}
            >
              <ShieldCheck className="h-3 w-3" />
              <TypewriterText
                text="Flipkart Gridlock 2.0"
                speed={34}
                start
                showCursor={false}
                onComplete={() => advance(1)}
              />
            </span>

            {/* Main title — premium font, typed reveal */}
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)] sm:text-6xl">
              <TypewriterText
                text={TITLE}
                speed={60}
                start={step >= 1}
                accentFromIndex={TITLE_ACCENT_FROM}
                accentClassName={accentText}
                cursorClassName={accentCursor}
                onComplete={() => advance(2)}
              />
            </h1>

            {/* Subtitle */}
            <p className="mt-4 max-w-xl font-display text-lg font-semibold text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.6)] sm:text-xl">
              <TypewriterText
                text={SUBTITLE}
                speed={20}
                start={step >= 2}
                cursorClassName={accentCursor}
                onComplete={() => advance(3)}
              />
            </p>

            {/* Description */}
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)] sm:text-base">
              <TypewriterText
                text={DESCRIPTION}
                speed={12}
                start={step >= 3}
                keepCursor
                cursorClassName={accentCursor}
                onComplete={() => advance(4)}
              />
            </p>

            {/* Footer bullets — fade/blur reveal in order */}
            <motion.div
              initial={false}
              animate={
                bulletsVisible
                  ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                  : { opacity: 0, y: 8, filter: 'blur(6px)' }
              }
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              {TRUST_ROW.map((item, i) => (
                <span key={item} className="flex items-center gap-3 font-mono text-xs text-white/75">
                  {i > 0 && <span className={accentText}>·</span>}
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${accentDot}`} />
                    {item}
                  </span>
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: login entry cards + demo video */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          >
            {ENTRY_CARDS.map((card) => (
              <EntryCardView key={card.to} card={card} />
            ))}
            <DemoVideoCard />
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 mx-auto max-w-7xl px-5 pb-6 sm:px-8">
          <p className="text-center font-mono text-[11px] text-white/55">
            Prototype for Flipkart Gridlock 2.0 · Bengaluru parking impact intelligence
          </p>
        </footer>
      </main>
    </div>
  )
}

// Fixed dark-glass cards: the homepage is a cinematic dark surface in BOTH
// themes (video stays visible), so light text guarantees readability either way.
const ACCENTS = {
  cyan: {
    icon: 'bg-cyan-400/15 text-cyan-300',
    border: 'hover:border-cyan-400/50 hover:shadow-[0_0_28px_rgba(34,211,238,0.25)]',
    cta: 'text-cyan-300',
  },
  amber: {
    icon: 'bg-amber-400/15 text-amber-300',
    border: 'hover:border-amber-400/50 hover:shadow-[0_0_28px_rgba(245,158,11,0.25)]',
    cta: 'text-amber-300',
  },
} as const

function EntryCardView({ card }: { card: EntryCard }) {
  const a = ACCENTS[card.accent]
  const Icon = card.icon
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4 }}>
      <Link
        to={card.to}
        className={`focus-ring-command group block rounded-2xl border border-white/12 bg-[#0a1626]/80 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 ${a.border}`}
      >
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">{card.title}</h3>
            <p className="mt-1 text-sm leading-snug text-white/70">{card.subtitle}</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold ${a.cta}`}>
              {card.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function DemoVideoCard() {
  const handleClick = () => {
    window.open(DEMO_VIDEO_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4 }}
      className="sm:col-span-2 lg:col-span-1"
    >
      <button
        type="button"
        data-testid="home-demo-card"
        onClick={handleClick}
        className="group focus-ring-command w-full rounded-2xl border border-white/12 bg-[#0a1626]/80 p-5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/50 hover:shadow-[0_0_28px_rgba(52,211,153,0.25)]"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <Play className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Watch System Demo</h3>
            <p className="mt-1 text-sm leading-snug text-white/70">
              View the complete GridLock Command walkthrough.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
              Watch demo
              <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  )
}
