import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Crosshair,
  FileWarning,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import { useHotspots } from '@/hooks/useHotspots'
import { StationPortalNavbar } from '@/components/layout/StationPortalNavbar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ModuleTabs } from '@/components/ui/ModuleTabs'
import { CommandMap } from '@/components/map/CommandMap'
import { formatStation, formatRoi, formatTimestamp } from '@/lib/formatters'
import { fieldInputClassName, fieldSelectClassName } from '@/lib/fieldStyles'
import { cn } from '@/lib/cn'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { generateImpactEvidence } from '@/data/impactEvidenceData'
import type { CommandHotspot, RouteLine } from '@/lib/hotspots'
import type { Classification } from '@/types/common'
import type { ApiPatrolRoute } from '@/types/api'
import { getRoutesByStation } from '@/services/routeService'
import { toRouteLine } from '@/lib/routes'
import { buildDemoPatrolRoute } from '@/lib/stationHelpers'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'
import { calcPatrolMetrics } from '@/lib/patrolMetrics'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StationFeedbackItem {
  id: string
  clusterId: string
  outcome: string
  note: string
  timestamp: string
  stationId: string
}

type EscalationStatus = 'needs-review' | 'ready-for-brief' | 'sent-to-admin'

interface StationEscalationFlag {
  clusterId: string
  status: EscalationStatus
  officerNote: string
  timestamp: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEEDBACK_OUTCOMES = [
  'Cleared',
  'Enforced but recurred',
  'Needs towing support',
  'Needs signage review',
  'Needs BBMP/BTP escalation',
] as const

const ESCALATION_REASON: Record<string, string> = {
  STRUCTURAL: 'Infrastructure bottleneck',
  RESPONSIVE: 'Repeat parking pressure',
  SEASONAL: 'Seasonal recurrence pattern',
}

const ESC_STATUS_LABELS: Record<EscalationStatus, string> = {
  'needs-review': 'Needs review',
  'ready-for-brief': 'Ready for brief',
  'sent-to-admin': 'Sent to admin/BTP',
}

const ESC_STATUS_COLORS: Record<EscalationStatus, string> = {
  'needs-review': 'text-status-amber bg-status-amber/10',
  'ready-for-brief': 'text-btp-cyan bg-btp-cyan/10',
  'sent-to-admin': 'text-status-cleared bg-status-cleared/10',
}

const SUMMARY_TONES = {
  cyan: 'text-btp-cyan',
  red: 'text-status-structural',
  amber: 'text-status-amber',
  route: 'text-status-route',
} as const

// ─── Storage helpers ──────────────────────────────────────────────────────────

function fbKey(id: string) {
  return `gridlock_station_feedback_${id}`
}
function escKey(id: string) {
  return `gridlock_station_escalation_${id}`
}

function loadFeedback(stationId: string): StationFeedbackItem[] {
  try {
    const raw = localStorage.getItem(fbKey(stationId))
    return raw ? (JSON.parse(raw) as StationFeedbackItem[]) : []
  } catch {
    return []
  }
}

function saveFeedbackList(stationId: string, items: StationFeedbackItem[]) {
  try {
    localStorage.setItem(fbKey(stationId), JSON.stringify(items))
  } catch { /* demo */ }
}

function loadEscalation(stationId: string): Record<string, StationEscalationFlag> {
  try {
    const raw = localStorage.getItem(escKey(stationId))
    return raw ? (JSON.parse(raw) as Record<string, StationEscalationFlag>) : {}
  } catch {
    return {}
  }
}

function saveEscalation(stationId: string, flags: Record<string, StationEscalationFlag>) {
  try {
    localStorage.setItem(escKey(stationId), JSON.stringify(flags))
  } catch { /* demo */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stopsToMapHotspots(route: RouteLine | null, stationHotspots: CommandHotspot[]): CommandHotspot[] {
  if (!route) return []
  const lookup = new Map(stationHotspots.map((h) => [h.cluster_id, h]))
  return route.stops.map((s) => {
    const found = lookup.get(s.cluster_id)
    if (found) return { ...found, lat: s.lat, lng: s.lng }
    return {
      cluster_id: s.cluster_id,
      lat: s.lat,
      lng: s.lng,
      station: route.station,
      classification: 'UNKNOWN' as const,
      roi: 0,
      violations: 0,
      lcle: null,
      bci: null,
      persistence: null,
      recurrence: null,
      osm_coverage: null,
      vehicle_mix: null,
      peak_window: null,
      road_class: null,
      road_width_m: null,
      recommended_action: null,
      escalation_boost: false,
      location_mode: null,
      junction_name_mode: null,
      raw: { cluster_id: s.cluster_id },
    }
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function StationDashboardPage() {
  const { stationId, displayName, logout } = useAuth()
  const navigate = useNavigate()
  const { hotspots, isLoading } = useHotspots()
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)

  const sid = stationId ?? ''
  const stationLabel = stationId ? formatStation(stationId) : 'Station'

  const { data: apiRoute } = useQuery({
    queryKey: ['stationRoute', sid],
    queryFn: () => getRoutesByStation(sid),
    enabled: !!sid,
  })

  const stationHotspots = useMemo(
    () => (stationId ? hotspots.filter((h) => h.station === stationId) : []),
    [hotspots, stationId],
  )

  const stationRoute = useMemo<RouteLine | null>(() => {
    if (apiRoute) return toRouteLine(apiRoute)
    return buildDemoPatrolRoute(stationHotspots, sid)
  }, [apiRoute, stationHotspots, sid])

  const onLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const openHotspotsTab = (id?: string) => {
    if (id) setSelectedHotspotId(id)
    setActiveTab('hotspots')
  }
  const openPatrolTab = () => setActiveTab('patrol')

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <OverviewTab
          hotspots={stationHotspots}
          stationId={sid}
          stationLabel={stationLabel}
          onOpenHotspots={openHotspotsTab}
          onOpenPatrol={openPatrolTab}
        />
      ),
    },
    {
      id: 'hotspots',
      label: 'Hotspots',
      content: (
        <HotspotsTab
          hotspots={stationHotspots}
          stationLabel={stationLabel}
          selectedId={selectedHotspotId}
          onSelectHotspot={setSelectedHotspotId}
          onOpenPatrol={openPatrolTab}
        />
      ),
    },
    {
      id: 'patrol',
      label: 'Patrol',
      content: (
        <PatrolTab
          hotspots={stationHotspots}
          stationId={sid}
          stationLabel={stationLabel}
          stationRoute={stationRoute}
          apiRoute={apiRoute ?? null}
          onOpenHotspots={openHotspotsTab}
        />
      ),
    },
    {
      id: 'feedback',
      label: 'Feedback',
      content: <FeedbackTab hotspots={stationHotspots} stationId={sid} />,
    },
    {
      id: 'escalation',
      label: 'Escalation',
      content: <EscalationTab hotspots={stationHotspots} stationId={sid} />,
    },
    {
      id: 'impact',
      label: 'Impact',
      content: (
        <ImpactTab hotspots={stationHotspots} stationId={sid} stationLabel={stationLabel} />
      ),
    },
  ]

  return (
    <div className="relative flex min-h-screen flex-col bg-app">
      <div className="aurora-bg" />
      <StationPortalNavbar
        stationLabel={stationLabel}
        displayName={displayName}
        onLogout={onLogout}
        variant="dashboard"
      />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-btp-cyan">
            <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
            Station portal · this enforcement window
          </p>
          <h1 className="mt-0.5 font-display text-xl font-bold text-shell sm:text-2xl">
            {stationLabel}
          </h1>
        </motion.div>
        {isLoading ? (
          <LoadingSkeleton lines={8} />
        ) : (
          <ModuleTabs
            tabs={tabs}
            active={activeTab}
            onTabChange={setActiveTab}
            layoutId="station-portal-tabs"
          />
        )}
      </main>
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <p className="text-[11px] text-shell-muted">
          Prototype for Flipkart Gridlock 2.0 · Station view restricted to {stationLabel}.
        </p>
      </footer>
    </div>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone: keyof typeof SUMMARY_TONES
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-3.5 backdrop-blur-xl"
    >
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-shell-muted">
        <Icon className={cn('h-3 w-3', SUMMARY_TONES[tone])} />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-shell">{value}</p>
    </motion.div>
  )
}

function ImpactKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone: keyof typeof SUMMARY_TONES
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-3.5 backdrop-blur-xl"
    >
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-shell-muted">
        <Icon className={cn('h-3 w-3', SUMMARY_TONES[tone])} />
        {label}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-shell">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-shell-muted">{hint}</p>}
    </motion.div>
  )
}

// ─── Station hotspot detail card (no admin route link) ────────────────────────

function StationHotspotDetailCard({
  hotspot,
  onUseForPatrol,
}: {
  hotspot: CommandHotspot | null
  onUseForPatrol?: () => void
}) {
  if (!hotspot) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 px-4 py-6 text-center">
        <div>
          <MousePointerClick className="mx-auto h-5 w-5 text-btp-cyan/50" />
          <p className="mt-1.5 text-xs font-semibold text-shell">Select a hotspot</p>
          <p className="mt-0.5 text-[11px] text-shell-muted">Click the map or a row below.</p>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={hotspot.cluster_id}
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -6 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="rounded-2xl border border-btp-cyan/20 bg-civic-navy/70 p-3.5 shadow-glow-cyan backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-btp-cyan">
              <Crosshair className="h-3 w-3" />
              Inspecting
            </p>
            <p className="mt-0.5 truncate text-base font-bold text-shell">
              {getHotspotDisplayName(hotspot)}
            </p>
            <p className="font-mono text-[9px] text-btp-cyan/55">{hotspot.cluster_id}</p>
            <p className="truncate text-[11px] text-shell-muted">
              {formatStation(hotspot.station)}
              {hotspot.peak_window ? ` · peak ${hotspot.peak_window}` : ''}
            </p>
          </div>
          {hotspot.classification !== 'UNKNOWN' && (
            <StatusBadge status={hotspot.classification as Classification} className="shrink-0" />
          )}
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {(
            [
              ['ROI', hotspot.roi.toFixed(1)],
              ['LCLE', hotspot.lcle != null ? `${hotspot.lcle.toFixed(0)}%` : '—'],
              ['BCI', hotspot.bci != null ? hotspot.bci.toFixed(3) : '—'],
              ['Viol.', hotspot.violations.toLocaleString('en-IN')],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-civic-dusk/60 px-2 py-1.5 text-center">
              <p className="text-xs font-bold tabular-nums text-shell">{value}</p>
              <p className="text-[8px] font-semibold uppercase tracking-wide text-shell-muted">
                {label}
              </p>
            </div>
          ))}
        </div>

        {hotspot.recommended_action && (
          <p className="mt-2.5 rounded-lg border border-btp-cyan/12 bg-civic-dusk/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-shell">
            {hotspot.recommended_action}
          </p>
        )}

        <div className="mt-2.5 flex gap-2">
          {onUseForPatrol && (
            <button
              type="button"
              onClick={onUseForPatrol}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-btp-cyan/15 py-2 text-xs font-semibold text-btp-cyan transition-colors hover:bg-btp-cyan/25"
            >
              <RouteIcon className="h-3.5 w-3.5" />
              Patrol tab
            </button>
          )}
          <Link
            to={`/station-hotspot/${hotspot.cluster_id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-btp-cyan/10 py-2 text-xs font-semibold text-btp-cyan transition-colors hover:bg-btp-cyan/20"
          >
            Full detail →
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  hotspots,
  stationId,
  stationLabel,
  onOpenHotspots,
  onOpenPatrol,
}: {
  hotspots: CommandHotspot[]
  stationId: string
  stationLabel: string
  onOpenHotspots: (id?: string) => void
  onOpenPatrol: () => void
}) {
  const structuralCount = hotspots.filter((h) => h.classification === 'STRUCTURAL').length
  const responsiveCount = hotspots.filter((h) => h.classification === 'RESPONSIVE').length
  const seasonalCount = hotspots.filter((h) => h.classification === 'SEASONAL').length
  const needsEscalation = hotspots.filter(
    (h) => h.classification === 'STRUCTURAL' || h.escalation_boost,
  ).length
  const patrolPriority = Math.min(hotspots.length, 5)

  const impactData = useMemo(() => {
    if (!hotspots.length) return null
    return generateImpactEvidence(
      `impact|${stationId}|week2`,
      hotspots.map((h) => ({
        cluster_id: h.cluster_id,
        assigned_station: h.station,
        violation_count: h.violations,
        classification: h.classification,
        recurrence: h.recurrence,
        roi_score: h.roi,
        persistence: h.persistence,
        feedback_structural_boost: h.escalation_boost ? 1 : 0,
      })),
    )
  }, [hotspots, stationId])

  const briefsReady = impactData?.briefReadiness.ready ?? 0
  const top = hotspots[0]
  const nextStep = impactData?.recommendedActions[0]
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (hotspots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center">
        <MapPin className="mx-auto h-8 w-8 text-btp-cyan/50" />
        <h2 className="mt-3 text-base font-bold text-shell">No hotspots for {stationLabel}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-shell-muted">
          No scored hotspots are assigned to this station yet. New clusters will appear once scored
          and assigned.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-btp-cyan shadow-glow-cyan" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-btp-cyan">
          Today · {today} · This enforcement window
        </span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <SummaryCard label="Active hotspots" value={hotspots.length} icon={MapPin} tone="cyan" />
        <SummaryCard label="Structural Issue" value={structuralCount} icon={ShieldAlert} tone="red" />
        <SummaryCard label="Patrol-Responsive" value={responsiveCount} icon={AlertTriangle} tone="amber" />
        <SummaryCard label="Seasonal Pattern" value={seasonalCount} icon={Activity} tone="route" />
        <SummaryCard label="Patrol priorities" value={patrolPriority} icon={Target} tone="route" />
        <SummaryCard label="Escalation reviews" value={needsEscalation} icon={FileWarning} tone="amber" />
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        {top && (
          <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-btp-cyan">
              Top Enforcement Priority
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-btp-cyan/10 text-btp-cyan">
                <Zap className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-shell">{getHotspotDisplayName(top)}</span>
                  {top.classification !== 'UNKNOWN' && (
                    <StatusBadge status={top.classification as Classification} />
                  )}
                  <span className="font-mono text-[9px] text-btp-cyan/50">{top.cluster_id}</span>
                </div>
                <p className="truncate text-[11px] text-shell-muted">
                  {top.recommended_action ?? 'Prioritise for patrol'}
                </p>
              </div>
              <span className="shrink-0 text-xl font-bold tabular-nums text-btp-cyan">
                {formatRoi(top.roi)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenHotspots(top.cluster_id)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-btp-cyan/12 py-2 text-xs font-semibold text-btp-cyan transition-colors hover:bg-btp-cyan/20"
            >
              Open hotspot detail
            </button>
          </div>
        )}

        {nextStep ? (
          <div className="rounded-2xl border border-status-amber/20 bg-civic-navy/55 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-status-amber">
              Recommended next step
            </p>
            <p className="mt-1.5 text-sm font-semibold text-shell">{nextStep.title}</p>
            <p className="mt-0.5 text-[11px] text-shell-muted">{nextStep.detail}</p>
            <button
              type="button"
              onClick={onOpenPatrol}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-status-amber/12 py-2 text-xs font-semibold text-status-amber transition-colors hover:bg-status-amber/20"
            >
              <RouteIcon className="h-3.5 w-3.5" />
              Open patrol route
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-btp-cyan">
              Briefs ready
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-shell">{briefsReady}</p>
            <p className="mt-0.5 text-[11px] text-shell-muted">
              Clusters with enforcement brief prepared
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Hotspots ────────────────────────────────────────────────────────────

function HotspotsTab({
  hotspots,
  stationLabel,
  selectedId,
  onSelectHotspot,
  onOpenPatrol,
}: {
  hotspots: CommandHotspot[]
  stationLabel: string
  selectedId: string | null
  onSelectHotspot: (id: string) => void
  onOpenPatrol: () => void
}) {
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('ALL')
  const [sortBy, setSortBy] = useState<'roi' | 'recurrence'>('roi')

  const filtered = useMemo(() => {
    let items = [...hotspots]
    if (filterClass !== 'ALL') {
      items = items.filter((h) => h.classification === filterClass)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (h) =>
          h.cluster_id.toLowerCase().includes(q) ||
          h.classification.toLowerCase().includes(q) ||
          (h.recommended_action ?? '').toLowerCase().includes(q),
      )
    }
    if (sortBy === 'recurrence') {
      items.sort((a, b) => (b.recurrence ?? 0) - (a.recurrence ?? 0))
    }
    return items
  }, [hotspots, search, filterClass, sortBy])

  const selectedHotspot = useMemo(
    () => hotspots.find((h) => h.cluster_id === selectedId) ?? null,
    [hotspots, selectedId],
  )

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-shell-muted/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cluster or action…"
            className="w-full rounded-xl border border-btp-cyan/15 bg-civic-navy/55 py-2 pl-8 pr-3 text-sm text-shell placeholder:text-shell-muted/60 backdrop-blur-xl focus:border-btp-cyan/40 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['ALL', 'STRUCTURAL', 'RESPONSIVE', 'SEASONAL'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterClass(c)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                filterClass === c
                  ? 'bg-btp-cyan/20 text-btp-cyan'
                  : 'text-shell-muted hover:text-shell',
              )}
            >
              {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSortBy(sortBy === 'roi' ? 'recurrence' : 'roi')}
          className="inline-flex items-center gap-1 rounded-lg border border-btp-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-shell-muted transition-colors hover:text-shell"
        >
          {sortBy === 'roi' ? 'Sort: Priority' : 'Sort: Recurrence'}
          {sortBy === 'roi' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        <span className="text-[11px] text-shell-muted">
          {filtered.length} cluster{filtered.length !== 1 ? 's' : ''} · {stationLabel}
        </span>
      </div>

      {hotspots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-btp-cyan/15 p-8 text-center text-sm text-shell-muted">
          No hotspots for {stationLabel}.
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          {/* Map — 60% on desktop */}
          <div className="h-[300px] w-full shrink-0 sm:h-[420px] lg:h-[520px] lg:w-[60%]">
            <CommandMap
              hotspots={filtered.length > 0 ? filtered : hotspots}
              selectedId={selectedId}
              onSelect={onSelectHotspot}
              className="h-full w-full"
              isAllStations={false}
              smartRender
              fitKey={stationLabel}
              showRoute={false}
            />
          </div>

          {/* Detail + list — 40% on desktop */}
          <div className="flex w-full flex-col gap-2.5 lg:w-[40%] lg:h-[520px]">
            <StationHotspotDetailCard hotspot={selectedHotspot} onUseForPatrol={onOpenPatrol} />

            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-shell-muted">No clusters match this filter.</p>
            ) : (
              <div className="min-h-[120px] flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-btp-cyan/12 bg-civic-navy/55 p-2 scrollbar-thin backdrop-blur-xl lg:max-h-[calc(520px-180px)]">
                {filtered.slice(0, 40).map((h, i) => (
                  <button
                    key={h.cluster_id}
                    type="button"
                    onClick={() => onSelectHotspot(h.cluster_id)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2 text-left transition-all',
                      selectedId === h.cluster_id
                        ? 'border-btp-cyan/40 bg-btp-blue/30 shadow-glow-cyan'
                        : 'border-transparent hover:border-btp-cyan/20 hover:bg-civic-white/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-shell-muted">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-shell">
                            {getHotspotDisplayName(h)}
                          </span>
                          <span className="font-mono text-[9px] text-btp-cyan/50">{h.cluster_id}</span>
                        </span>
                        {h.classification !== 'UNKNOWN' && (
                          <StatusBadge
                            status={h.classification as Classification}
                            className="shrink-0"
                          />
                        )}
                        {h.escalation_boost && (
                          <span className="shrink-0 rounded bg-status-structural/15 px-1 py-0.5 text-[9px] font-bold text-status-structural">
                            ESC
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-btp-cyan">
                        {formatRoi(h.roi)}
                      </span>
                    </div>
                    {h.peak_window && (
                      <p className="mt-0.5 pl-7 text-[10px] text-shell-muted">
                        Peak {h.peak_window}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Patrol ──────────────────────────────────────────────────────────────

function PatrolTab({
  hotspots,
  stationId,
  stationLabel,
  stationRoute,
  apiRoute,
  onOpenHotspots,
}: {
  hotspots: CommandHotspot[]
  stationId: string
  stationLabel: string
  stationRoute: RouteLine | null
  apiRoute: ApiPatrolRoute | null
  onOpenHotspots: (id?: string) => void
}) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)

  const stops = stationRoute?.stops ?? []

  const stopHotspots = useMemo(
    () => stopsToMapHotspots(stationRoute, hotspots),
    [stationRoute, hotspots],
  )

  const patrolMetrics = useMemo(
    () =>
      stationRoute
        ? calcPatrolMetrics(stationRoute, stopHotspots, {
            apiDistanceKm: apiRoute?.estimated_route_km,
            apiDurationMin: apiRoute?.estimated_total_minutes,
          })
        : null,
    [stationRoute, stopHotspots, apiRoute],
  )

  const distanceKm = patrolMetrics?.approxDistanceKm ?? 0
  const durationMin = patrolMetrics?.totalMinutes ?? 0
  const officerHours = patrolMetrics?.officerHours ?? 1

  if (!stationRoute || stops.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-btp-cyan/15 p-8 text-center">
        <RouteIcon className="mx-auto h-8 w-8 text-btp-cyan/40" />
        <p className="mt-3 text-sm font-semibold text-shell">No patrol route for {stationLabel}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-shell-muted">
          A route is generated once at least 2 hotspots are available for this station.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Route header / KPI strip */}
      <div className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-4 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-btp-cyan">
              {stationRoute.route_id}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-shell">
              {stationLabel} · {stops.length}-stop patrol route
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            {(
              [
                ['Stops', String(stops.length)],
                ['~Distance', `${distanceKm} km`],
                ['~Duration', `${durationMin} min`],
                ['Officer-hrs', `${officerHours}h`],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="text-right">
                <p className="text-sm font-bold tabular-nums text-shell">{value}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-shell-muted">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map + stop sequence */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* Route map — 60% on desktop */}
        <div className="h-[300px] w-full shrink-0 sm:h-[400px] lg:h-[480px] lg:w-[60%]">
          <CommandMap
            hotspots={stopHotspots}
            route={stationRoute}
            selectedId={selectedStopId}
            onSelect={(id) => setSelectedStopId((prev) => (prev === id ? null : id))}
            className="h-full w-full"
            isAllStations={false}
            smartRender={false}
            fitKey={stationId}
            showRoute
            showHotspots
          />
        </div>

        {/* Stop sequence — 40% on desktop */}
        <div className="w-full space-y-2 lg:w-[40%] lg:h-[480px] lg:overflow-y-auto lg:scrollbar-thin">
          {stops.map((stop, i) => {
            const h = hotspots.find((x) => x.cluster_id === stop.cluster_id)
            const isSelected = selectedStopId === stop.cluster_id
            return (
              <div
                key={stop.cluster_id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedStopId((prev) => (prev === stop.cluster_id ? null : stop.cluster_id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedStopId((prev) => (prev === stop.cluster_id ? null : stop.cluster_id))
                  }
                }}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition-all',
                  isSelected
                    ? 'border-btp-cyan/40 bg-btp-blue/30 shadow-glow-cyan'
                    : 'border-btp-cyan/12 bg-civic-navy/55 hover:border-btp-cyan/25',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-status-route/15 text-xs font-bold text-status-route">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-shell">
                        {h ? getHotspotDisplayName(h) : stop.cluster_id}
                      </span>
                      {h && h.classification !== 'UNKNOWN' && (
                        <StatusBadge
                          status={h.classification as Classification}
                          className="shrink-0"
                        />
                      )}
                    </div>
                    <span className="font-mono text-[9px] text-btp-cyan/50">{stop.cluster_id}</span>
                    {h && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-shell-muted">
                        {h.peak_window ? `Peak ${h.peak_window}` : ''}
                        {h.recommended_action ? `${h.peak_window ? ' · ' : ''}${h.recommended_action}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {h && (
                      <>
                        <p className="text-sm font-bold tabular-nums text-btp-cyan">
                          {formatRoi(h.roi)}
                        </p>
                        <p className="text-[9px] uppercase tracking-wide text-shell-muted">Priority</p>
                        <p className="font-mono text-[7px] text-shell-muted/50">ROI</p>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenHotspots(stop.cluster_id)
                  }}
                  className="mt-2 text-[11px] font-semibold text-btp-cyan hover:text-btp-cyan/80"
                >
                  Open hotspot detail →
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Feedback ────────────────────────────────────────────────────────────

function FeedbackTab({
  hotspots,
  stationId,
}: {
  hotspots: CommandHotspot[]
  stationId: string
}) {
  const [items, setItems] = useState<StationFeedbackItem[]>(() => loadFeedback(stationId))
  const [clusterId, setClusterId] = useState(hotspots[0]?.cluster_id ?? '')
  const hotspotLookup = useMemo(
    () => new Map(hotspots.map((h) => [h.cluster_id, h])),
    [hotspots],
  )
  const [outcome, setOutcome] = useState<string>(FEEDBACK_OUTCOMES[0])
  const [note, setNote] = useState('')

  const submit = () => {
    if (!clusterId) return
    const item: StationFeedbackItem = {
      id: `fb-${Date.now()}`,
      clusterId,
      outcome,
      note: note.trim(),
      timestamp: new Date().toISOString(),
      stationId,
    }
    const updated = [item, ...items].slice(0, 50)
    setItems(updated)
    saveFeedbackList(stationId, updated)
    setNote('')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 backdrop-blur-xl">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-btp-cyan">
          Log enforcement outcome
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-shell-muted">
              Cluster
            </label>
            <select
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              className={cn('w-full', fieldSelectClassName)}
            >
              {hotspots.map((h) => (
                <option key={h.cluster_id} value={h.cluster_id}>
                  {getHotspotDisplayName(h)} · {h.cluster_id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-shell-muted">
              Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className={cn('w-full', fieldSelectClassName)}
            >
              {FEEDBACK_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-shell-muted">
              Officer note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add observation…"
              rows={2}
              className={cn('w-full resize-none', fieldInputClassName)}
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!clusterId}
            className="inline-flex items-center gap-2 rounded-xl bg-btp-blue px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Submit feedback
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-shell-muted">
            Recent logs
          </p>
          {items.slice(0, 15).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 p-3 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-shell">
                    {(() => { const h = hotspotLookup.get(item.clusterId); return h ? getHotspotDisplayName(h) : item.clusterId })()}
                  </span>
                  <span className="font-mono text-[9px] text-btp-cyan/50">{item.clusterId}</span>
                </span>
                <span className="shrink-0 text-[10px] text-shell-muted">
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-btp-cyan">{item.outcome}</p>
              {item.note && (
                <p className="mt-0.5 text-[11px] text-shell-muted">{item.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Escalation ─────────────────────────────────────────────────────────

function EscalationTab({
  hotspots,
  stationId,
}: {
  hotspots: CommandHotspot[]
  stationId: string
}) {
  const [flags, setFlags] = useState<Record<string, StationEscalationFlag>>(
    () => loadEscalation(stationId),
  )

  const candidates = useMemo(
    () =>
      hotspots.filter(
        (h) => h.classification === 'STRUCTURAL' || h.escalation_boost,
      ),
    [hotspots],
  )

  const flag = (clusterId: string, status: EscalationStatus, officerNote: string) => {
    const updated = {
      ...flags,
      [clusterId]: {
        clusterId,
        status,
        officerNote,
        timestamp: new Date().toISOString(),
      },
    }
    setFlags(updated)
    saveEscalation(stationId, updated)
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-status-cleared/60" />
        <h2 className="mt-3 text-base font-bold text-shell">No escalation candidates</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-shell-muted">
          No structural or high-priority hotspots require escalation review at this time.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-shell-muted">
        {candidates.length} cluster{candidates.length !== 1 ? 's' : ''} flagged for
        escalation review
      </p>
      {candidates.map((h) => {
        const current = flags[h.cluster_id]
        return (
          <EscalationCard
            key={h.cluster_id}
            hotspot={h}
            current={current ?? null}
            onFlag={flag}
          />
        )
      })}
    </div>
  )
}

function EscalationCard({
  hotspot,
  current,
  onFlag,
}: {
  hotspot: CommandHotspot
  current: StationEscalationFlag | null
  onFlag: (id: string, status: EscalationStatus, note: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState(current?.officerNote ?? '')
  const [status, setStatus] = useState<EscalationStatus>(current?.status ?? 'needs-review')

  return (
    <div className="rounded-xl border border-status-structural/20 bg-civic-navy/55 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-structural" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-shell">{getHotspotDisplayName(hotspot)}</span>
            {hotspot.classification !== 'UNKNOWN' && (
              <StatusBadge status={hotspot.classification as Classification} />
            )}
            {current && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  ESC_STATUS_COLORS[current.status],
                )}
              >
                {ESC_STATUS_LABELS[current.status]}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-btp-cyan/50">{hotspot.cluster_id}</p>
          <p className="mt-0.5 text-[11px] text-shell-muted">
            {ESCALATION_REASON[hotspot.classification] ?? 'Review recommended'}
            {hotspot.escalation_boost ? ' · Feedback-boosted' : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-btp-cyan">{formatRoi(hotspot.roi)}</p>
          <p className="text-[9px] uppercase tracking-wide text-shell-muted">ROI</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-btp-cyan hover:text-btp-cyan/80"
      >
        <FileWarning className="h-3 w-3" />
        {expanded ? 'Close' : 'Flag / update status'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2.5 border-t border-btp-cyan/8 pt-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-shell-muted">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EscalationStatus)}
              className={cn('w-full', fieldSelectClassName)}
            >
              {(Object.entries(ESC_STATUS_LABELS) as [EscalationStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-shell-muted">
              Officer note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the situation…"
              rows={2}
              className={cn('w-full resize-none', fieldInputClassName)}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onFlag(hotspot.cluster_id, status, note)
              setExpanded(false)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-status-structural/15 px-4 py-2 text-xs font-semibold text-status-structural transition-colors hover:bg-status-structural/25"
          >
            Save escalation flag
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Impact ──────────────────────────────────────────────────────────────

function WeekStrip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-shell-muted">
        {label}
      </p>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {children}
      </motion.div>
    </div>
  )
}

function ImpactTab({
  hotspots,
  stationId,
  stationLabel,
}: {
  hotspots: CommandHotspot[]
  stationId: string
  stationLabel: string
}) {
  const impactData = useMemo(() => {
    if (!hotspots.length) return null
    return generateImpactEvidence(
      `impact|${stationId}|week2`,
      hotspots.map((h) => ({
        cluster_id: h.cluster_id,
        assigned_station: h.station,
        violation_count: h.violations,
        classification: h.classification,
        recurrence: h.recurrence,
        roi_score: h.roi,
        persistence: h.persistence,
        feedback_structural_boost: h.escalation_boost ? 1 : 0,
      })),
    )
  }, [hotspots, stationId])

  if (!impactData) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center">
        <TrendingDown className="mx-auto h-8 w-8 text-btp-cyan/40" />
        <h2 className="mt-3 text-base font-bold text-shell">No impact data for {stationLabel}</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-shell-muted">
          Impact evidence requires at least one scored hotspot for this station.
        </p>
      </div>
    )
  }

  const w1 = impactData.week1
  const w2 = impactData.week2
  const kpis = impactData.kpis
  const briefs = impactData.briefReadiness

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-btp-cyan/20 bg-civic-navy/55 px-3 py-1 text-[11px] font-semibold text-shell-muted backdrop-blur-sm">
          <TrendingUp className="h-3 w-3 text-status-cleared" />
          2-week enforcement impact summary
        </span>
      </div>

      <WeekStrip label="Week 1 — Baseline (pre-route enforcement)">
        <ImpactKpiCard
          label="Violation pressure"
          value={w1.totalPressure}
          hint="Unguided patrol"
          icon={AlertTriangle}
          tone="red"
        />
        <ImpactKpiCard
          label="Structural-issue hotspots"
          value={w1.structuralHotspots}
          icon={ShieldAlert}
          tone="red"
        />
        <ImpactKpiCard
          label="Patrol-responsive hotspots"
          value={w1.responsiveHotspots}
          icon={Activity}
          tone="amber"
        />
        <ImpactKpiCard
          label="Recurring hotspots"
          value={w1.repeatRecurrence}
          icon={AlertTriangle}
          tone="amber"
        />
        <ImpactKpiCard
          label="Officer-hours"
          value={w1.officerHours}
          hint="Unguided patrol"
          icon={Target}
          tone="route"
        />
        <ImpactKpiCard
          label="Escalation ready"
          value={w1.escalationReady}
          icon={ClipboardList}
          tone="cyan"
        />
      </WeekStrip>

      <WeekStrip label="Week 2 — With Priority-routed patrol">
        <ImpactKpiCard
          label="Violation pressure"
          value={w2.totalPressure}
          hint="With M10 patrol"
          icon={AlertTriangle}
          tone={w2.totalPressure < w1.totalPressure ? 'cyan' : 'red'}
        />
        <ImpactKpiCard
          label="Structural-issue hotspots"
          value={w2.structuralHotspots}
          icon={ShieldAlert}
          tone="red"
        />
        <ImpactKpiCard
          label="Patrol-responsive hotspots"
          value={w2.responsiveHotspots}
          icon={Activity}
          tone="amber"
        />
        <ImpactKpiCard
          label="Recurring hotspots"
          value={w2.repeatRecurrence}
          icon={Activity}
          tone={w2.repeatRecurrence < w1.repeatRecurrence ? 'cyan' : 'amber'}
        />
        <ImpactKpiCard
          label="Officer-hours"
          value={w2.officerHours}
          hint="Guided M10 patrol"
          icon={Target}
          tone="route"
        />
        <ImpactKpiCard
          label="Briefs ready"
          value={briefs.ready}
          hint="Clusters briefed"
          icon={ClipboardList}
          tone="cyan"
        />
      </WeekStrip>

      <div className="rounded-2xl border border-status-cleared/20 bg-civic-navy/55 p-4 backdrop-blur-xl">
        <p className="text-[10px] font-bold uppercase tracking-wider text-status-cleared">
          Week-on-week delta
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['Pressure Δ', `${kpis.pressureChangePct > 0 ? '+' : ''}${kpis.pressureChangePct}%`, true],
              ['Recurring before', kpis.recurringBefore, true],
              ['Recurring after', kpis.recurringAfter, true],
              ['Patrol efficiency', `+${kpis.patrolEfficiencyGainPct}%`, false],
            ] as [string, string | number, boolean][]
          ).map(([label, value, lowerIsBetter]) => {
            const strVal = String(value)
            const num = parseFloat(strVal.replace('%', '').replace('+', ''))
            const improved = lowerIsBetter ? num <= 0 : num >= 0
            return (
              <div key={label} className="rounded-lg bg-civic-dusk/60 p-3 text-center">
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    improved ? 'text-status-cleared' : 'text-status-structural',
                  )}
                >
                  {value}
                </p>
                <p className="mt-0.5 text-[10px] text-shell-muted">{label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
