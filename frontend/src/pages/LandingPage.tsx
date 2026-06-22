import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Database,
  FileText,
  GitBranch,
  MapPin,
  Route,
  ShieldCheck,
  Siren,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { getSummary, getHealth } from '@/services/summaryService'
import { getInfraEscalationCandidates, getInfraPdfs } from '@/services/infraService'
import { getRoutes } from '@/services/routeService'
import { useApiHealth } from '@/hooks/useApiHealth'
import { useTheme } from '@/theme/ThemeProvider'
import { ThemeSelector } from '@/components/layout/ThemeSelector'
import { CommandButton } from '@/components/ui/CommandButton'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { CityPulseHero } from '@/components/motion/CityPulseHero'
import { PageTransition } from '@/components/motion/PageTransition'
import { OperationalSnapshotSection } from '@/components/home/OperationalSnapshotSection'
import type { SnapshotMetric } from '@/components/home/MotionMetricCard'
import { cn } from '@/lib/cn'
import { fadeUp, slideInLeft, slideInRight, staggerContainer, viewportOnce } from '@/lib/motion'

const HERO_VIDEO = '/media/gridlock-hero-network-loop.mp4'
const HERO_POSTER = '/media/gridlock-hero-network-poster.png'

const WORKFLOW_STEPS = [
  { label: 'FTVR Records', icon: Database, blurb: 'Anonymised parking violation feed ingested and cleaned.' },
  { label: 'Hotspot Clusters', icon: MapPin, blurb: 'Geospatial clustering surfaces recurring violation zones.' },
  { label: 'LCLE + BCI + ROI', icon: BarChart3, blurb: 'Scored by traffic impact per officer-hour, not raw count.' },
  { label: 'Patrol Route', icon: Route, blurb: 'Station-wise routes built over an OSM road graph.' },
  { label: 'Officer Feedback', icon: GitBranch, blurb: 'Field outcomes feed back into the next plan.' },
  { label: 'Structural Escalation', icon: FileText, blurb: 'Recurring sites escalate to BBMP/BTP infra briefs.' },
]

export function LandingPage() {
  const { data: summary, isLoading } = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: getHealth })
  const { data: infra } = useQuery({ queryKey: ['infra'], queryFn: getInfraEscalationCandidates })
  const { data: routesRes } = useQuery({ queryKey: ['routes'], queryFn: getRoutes })
  const { data: pdfs } = useQuery({ queryKey: ['infraPdfs'], queryFn: getInfraPdfs })
  const { label: apiLabel } = useApiHealth()
  const { themeDefinition } = useTheme()

  const escalationReady = infra?.filter((c) => c.infra_escalation_ready === 1).length ?? 0
  const routeCount = routesRes?.routes?.length ?? 0

  const snapshotMetrics: SnapshotMetric[] = [
    {
      id: 'hotspots',
      label: 'Hotspots Scored',
      microcopy: 'Risk-ranked parking clusters',
      value: summary?.total_hotspots,
      tone: 'cyan',
      icon: MapPin,
      featured: true,
    },
    {
      id: 'structural',
      label: 'Structural Watch',
      microcopy: 'Recurring congestion zones',
      value: summary?.structural_count,
      tone: 'structural',
      icon: Siren,
    },
    {
      id: 'violations',
      label: 'Violations Analysed',
      microcopy: 'Historical FTVR records',
      value: summary?.total_violations,
      tone: 'cyan',
      icon: Database,
      featured: true,
    },
    {
      id: 'routes',
      label: 'Patrol Routes',
      microcopy: 'Optimized enforcement paths',
      value: routeCount > 0 ? routeCount : undefined,
      fallbackDisplay: routeCount > 0 ? undefined : (summary?.routing_mode ?? '—'),
      tone: 'route',
      icon: Route,
    },
    {
      id: 'escalation',
      label: 'Escalation Watch',
      microcopy: 'Needs officer review',
      value: escalationReady,
      tone: 'amber',
      icon: FileText,
    },
  ]

  return (
    <PageTransition>
      <div className="relative min-h-screen overflow-hidden bg-app">
        <div className="aurora-bg" />

        {/* Landing top bar */}
        <header className="relative z-20 border-b border-shell bg-shell-nav backdrop-blur-xl">
          <div className="page-container flex items-center justify-between gap-3 !py-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={34} />
              <div>
                <p className="text-sm font-bold text-shell">{APP_NAME}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                  {themeDefinition.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSelector compact />
              <Link to="/command" className="hidden sm:block">
                <CommandButton variant="secondary" size="sm">
                  Enter Command Center
                  <ArrowRight className="h-4 w-4" />
                </CommandButton>
              </Link>
            </div>
          </div>
        </header>

        {/* A. Cinematic hero */}
        <section className="relative z-10">
          <div className="page-container grid min-h-[82vh] items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-16">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.span
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-btp-cyan/30 bg-btp-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-btp-cyan"
              >
                <ShieldCheck className="h-3 w-3" />
                Flipkart Gridlock 2.0 · BTP Parking Intelligence
              </motion.span>

              <motion.h1
                variants={fadeUp}
                className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-civic-white sm:text-6xl"
              >
                GridLock <span className="text-btp-cyan">Command</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-4 max-w-xl font-display text-xl font-semibold text-civic-ivory sm:text-2xl"
              >
                Parking violations are not the problem.{' '}
                <span className="text-status-amber">Traffic impact is.</span>
              </motion.p>

              <motion.p variants={fadeUp} className="mt-4 max-w-xl text-sm leading-relaxed text-civic-ivory/65 sm:text-base">
                Convert FTVR records into ROI-ranked hotspots, station-wise patrol routes, officer
                feedback learning, and BBMP/BTP escalation briefs.
              </motion.p>

              <motion.blockquote
                variants={fadeUp}
                className="mt-5 border-l-2 border-btp-cyan pl-4 text-sm font-semibold italic text-civic-white"
              >
                Patrol by impact per officer-hour, not raw challan count.
              </motion.blockquote>

              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to="/command">
                  <CommandButton size="lg" variant="cyan" className="w-full sm:w-auto">
                    Enter Command Center
                    <ArrowRight className="h-5 w-5" />
                  </CommandButton>
                </Link>
                <Link to="/demo">
                  <CommandButton variant="secondary" size="lg" className="w-full sm:w-auto">
                    Start Demo Mode
                  </CommandButton>
                </Link>
              </motion.div>

              <motion.p variants={fadeUp} className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-civic-ivory/50">
                <span>Human-in-loop enforcement</span>
                <span className="text-btp-cyan/50">·</span>
                <span>File-backed API</span>
                <span className="text-btp-cyan/50">·</span>
                <span>Dry-run dispatch</span>
              </motion.p>
            </motion.div>

            <motion.div variants={slideInRight} initial="hidden" animate="visible" className="relative">
              <CityPulseHero videoSrc={HERO_VIDEO} posterSrc={HERO_POSTER} className="lg:min-h-[460px]" />
            </motion.div>
          </div>

        </section>

        {/* B. Live command snapshot */}
        <OperationalSnapshotSection metrics={snapshotMetrics} isLoading={isLoading} />

        {/* C. Why this is different */}
        <section className="relative z-10 page-container py-16">
          <SectionEyebrow>Why this is different</SectionEyebrow>
          <h2 className="mt-1 max-w-2xl font-display text-3xl font-bold text-civic-white">
            Traffic-impact intelligence, not another challan counter
          </h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="mt-10 grid gap-5 lg:grid-cols-3"
          >
            <WhyCard
              index={1}
              icon={BarChart3}
              title="ROI over raw challan count"
              body="High challan volume does not always mean high traffic damage. GridLock ranks hotspots by traffic impact per officer-hour."
              visual={<MiniBars />}
              accent="cyan"
            />
            <WhyCard
              index={2}
              icon={Route}
              title="Route-ready enforcement"
              body="Station-wise hotspot priorities are converted into ready-to-run patrol routes using OSM road-graph routing where available."
              visual={<MiniRoute />}
              accent="route"
            />
            <WhyCard
              index={3}
              icon={Zap}
              title="Feedback-to-infrastructure loop"
              body="If enforcement happens but the hotspot recurs, the system pushes the location toward structural watch and escalation."
              visual={<MiniLoop />}
              accent="structural"
            />
          </motion.div>
        </section>

        {/* D. Closed-loop workflow timeline */}
        <section className="relative z-10 border-y border-btp-cyan/10 bg-civic-dusk/60 py-16">
          <div className="page-container">
            <SectionEyebrow>Closed-loop workflow</SectionEyebrow>
            <h2 className="mt-1 font-display text-3xl font-bold text-civic-white">
              From record to structural escalation
            </h2>

            {/* Desktop horizontal timeline */}
            <div className="relative mt-12 hidden lg:block">
              {/* base track */}
              <div className="absolute left-0 right-0 top-6 h-px bg-btp-cyan/10" />
              {/* line that draws itself across on scroll-in */}
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={viewportOnce}
                transition={{ duration: 1.6, ease: 'easeInOut' }}
                style={{ originX: 0 }}
                className="absolute left-0 right-0 top-6 h-px signal-line"
              />
              {/* traveling signal pulse that loops along the track */}
              <motion.span
                aria-hidden
                initial={{ left: '0%', opacity: 0 }}
                whileInView={{ left: '100%', opacity: [0, 1, 1, 0] }}
                viewport={viewportOnce}
                transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.2, delay: 1.4 }}
                className="absolute top-6 -ml-1 h-2 w-2 -translate-y-1/2 rounded-full bg-btp-cyan shadow-glow-cyan"
              />

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                className="relative grid grid-cols-6 gap-3"
              >
                {WORKFLOW_STEPS.map((step, i) => (
                  <motion.div
                    key={step.label}
                    variants={fadeUp}
                    className="group/step flex flex-col items-center text-center"
                  >
                    <motion.div
                      whileHover={{ scale: 1.12, y: -2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-btp-cyan/30 bg-civic-navy text-btp-cyan shadow-glow-cyan"
                    >
                      {/* pulsing halo ring, staggered per node */}
                      <motion.span
                        className="absolute inset-0 rounded-full border border-btp-cyan/40"
                        animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
                      />
                      <step.icon className="relative h-5 w-5 transition-colors group-hover/step:text-civic-white" />
                      <motion.span
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={viewportOnce}
                        transition={{ type: 'spring', stiffness: 500, damping: 16, delay: 0.3 + i * 0.12 }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-btp-cyan text-[9px] font-bold text-civic-navy"
                      >
                        {i + 1}
                      </motion.span>
                    </motion.div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-civic-white transition-colors group-hover/step:text-btp-cyan">
                      {step.label}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-snug text-civic-ivory/55">{step.blurb}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Mobile vertical timeline */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="mt-10 space-y-4 lg:hidden"
            >
              {WORKFLOW_STEPS.map((step, i) => (
                <motion.div key={step.label} variants={slideInLeft} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <motion.div
                      whileTap={{ scale: 0.92 }}
                      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-btp-cyan/30 bg-civic-navy text-btp-cyan"
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full border border-btp-cyan/40"
                        animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
                      />
                      <step.icon className="relative h-4 w-4" />
                    </motion.div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <motion.div
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={viewportOnce}
                        transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                        style={{ originY: 0 }}
                        className="mt-1 w-px flex-1 bg-btp-cyan/25"
                      />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-bold text-civic-white">
                      <span className="mr-1 text-btp-cyan">{i + 1}.</span>
                      {step.label}
                    </p>
                    <p className="mt-1 text-xs text-civic-ivory/60">{step.blurb}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* E. Backend credibility + Final CTA */}
        <section className="relative z-10 page-container py-16">
          <div className="command-panel">
            <div className="aurora-bg opacity-60" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <SectionEyebrow>Command access</SectionEyebrow>
                <h2 className="mt-2 font-display text-3xl font-bold text-civic-white sm:text-4xl">
                  Open today&apos;s command view
                </h2>
                <p className="mt-3 max-w-lg text-sm text-civic-ivory/70">
                  ROI-ranked hotspots, station patrol routes, and human-in-loop approval — ready for
                  Bengaluru Traffic Police operations.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/command">
                    <CommandButton size="lg" variant="cyan">
                      Enter Command Center
                      <ArrowRight className="h-5 w-5" />
                    </CommandButton>
                  </Link>
                  <Link to="/demo">
                    <CommandButton size="lg" variant="secondary">
                      Start Demo Mode
                    </CommandButton>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-btp-cyan/15 bg-civic-dusk/50 p-5 backdrop-blur-xl">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-btp-cyan">
                  Backend credibility
                </p>
                <ul className="space-y-2.5">
                  <CredItem label={apiLabel} />
                  <CredItem label={`${summary?.total_hotspots ?? '—'} hotspots scored`} />
                  <CredItem label={`${routeCount} patrol route groups`} />
                  <CredItem label="Dry-run notifications available" />
                  <CredItem label={`${pdfs?.length ?? 0} escalation briefs (PDF)`} />
                  <CredItem label={health?.ok ? 'Backend files OK' : 'Backend check pending'} />
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  )
}

/* ---------- helpers ---------- */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-btp-cyan">
      <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
      {children}
    </p>
  )
}

const WHY_ACCENTS = {
  cyan: { ring: 'hover:border-btp-cyan/40 hover:shadow-glow-cyan', chip: 'bg-btp-cyan/10 text-btp-cyan', text: 'text-btp-cyan' },
  route: { ring: 'hover:border-status-route/40 hover:shadow-glow-amber', chip: 'bg-status-route/10 text-status-route', text: 'text-status-route' },
  structural: { ring: 'hover:border-status-structural/40 hover:shadow-glow-red', chip: 'bg-status-structural/10 text-status-structural', text: 'text-status-structural' },
} as const

function WhyCard({
  index,
  icon: Icon,
  title,
  body,
  visual,
  accent = 'cyan',
}: {
  index: number
  icon: LucideIcon
  title: string
  body: string
  visual: React.ReactNode
  accent?: keyof typeof WHY_ACCENTS
}) {
  const a = WHY_ACCENTS[accent]
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6 }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border border-btp-cyan/12 bg-gradient-to-b from-civic-navy/70 to-civic-dusk/60 p-6 backdrop-blur-xl transition-all duration-300',
        a.ring,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-30',
          a.chip,
        )}
      />
      <div className="relative flex items-center justify-between">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', a.chip)}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="font-display text-4xl font-bold text-civic-white/8 transition-colors group-hover:text-civic-white/15">
          0{index}
        </span>
      </div>
      <h3 className="relative mt-5 text-lg font-bold text-civic-white">{title}</h3>
      <p className="relative mt-2 flex-1 text-sm leading-relaxed text-civic-ivory/65">{body}</p>
      <div className="relative mt-5">{visual}</div>
    </motion.div>
  )
}

function CredItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-civic-ivory/80">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-btp-cyan shadow-glow-cyan" />
      {label}
    </li>
  )
}

function MiniBars() {
  // ROI dwarfs raw count — the whole thesis of the product.
  const bars = [
    { h: 52, c: 'bg-gradient-to-t from-btp-signal to-btp-cyan', label: 'ROI impact', val: 'High' },
    { h: 18, c: 'bg-civic-ivory/20', label: 'Raw count', val: 'Noisy' },
  ]
  return (
    <div className="rounded-xl border border-btp-cyan/10 bg-civic-dusk/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-civic-ivory/45">
          Impact / officer-hour
        </span>
        <span className="rounded-full bg-btp-cyan/10 px-2 py-0.5 text-[9px] font-bold text-btp-cyan">
          3.2× signal
        </span>
      </div>
      <div className="flex items-end gap-3">
        {bars.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-14 w-full items-end">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: b.h }}
                viewport={viewportOnce}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn('w-full rounded-md', b.c)}
              />
            </div>
            <span className="text-[9px] uppercase tracking-wide text-civic-ivory/50">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniRoute() {
  const stops = [
    { cx: 8, cy: 24 },
    { cx: 34, cy: 11 },
    { cx: 60, cy: 19 },
    { cx: 92, cy: 9 },
  ]
  return (
    <div className="rounded-xl border border-status-route/15 bg-civic-dusk/50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-civic-ivory/45">
          Patrol sequence
        </span>
        <span className="rounded-full bg-status-route/10 px-2 py-0.5 text-[9px] font-bold text-status-route">
          4 stops
        </span>
      </div>
      <svg viewBox="0 0 100 32" className="h-12 w-full" aria-hidden>
        <path d="M 8 24 Q 22 4, 34 11 T 60 19 T 92 9" fill="none" stroke="rgba(249,115,22,0.18)" strokeWidth="2.4" />
        <motion.path
          d="M 8 24 Q 22 4, 34 11 T 60 19 T 92 9"
          fill="none"
          stroke="#F97316"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray="3 3"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={viewportOnce}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
        {stops.map((s, i) => (
          <motion.circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r="2.6"
            fill="#22D3EE"
            stroke="#06111F"
            strokeWidth="0.8"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={viewportOnce}
            transition={{ delay: 0.3 + i * 0.18 }}
          />
        ))}
      </svg>
    </div>
  )
}

function MiniLoop() {
  const steps = [
    { label: 'Enforced', cls: 'bg-status-cleared/15 text-status-cleared' },
    { label: 'Recurred', cls: 'bg-status-amber/15 text-status-amber' },
    { label: 'Structural', cls: 'bg-status-structural/15 text-status-structural' },
  ]
  return (
    <div className="rounded-xl border border-status-structural/15 bg-civic-dusk/50 p-3">
      <div className="flex items-center justify-between gap-1.5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={viewportOnce}
              transition={{ delay: i * 0.2 }}
              className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide', s.cls)}
            >
              {s.label}
            </motion.span>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-civic-ivory/40" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] uppercase tracking-wide text-civic-ivory/40">
        Recurrence drives the escalation
      </p>
    </div>
  )
}
