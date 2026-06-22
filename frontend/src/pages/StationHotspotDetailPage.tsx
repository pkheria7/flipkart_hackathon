/**
 * Station-scoped hotspot detail page.
 *
 * Security constraints:
 *  - Only accessible via ProtectedRoute requireRole="station"
 *  - Station guard: if assigned_station ≠ logged-in stationId → Access denied screen
 *  - No admin AppShell / sidebar
 *  - No admin route links
 *
 * Styling: identical to the admin HotspotDetailPage — uses bg-app + page-container
 * so it respects aurora-dusk (dark) and bengaluru-daylight (light) themes.
 */
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Crosshair, Gauge, MapPin, Network, TrendingUp } from 'lucide-react'
import { MetricInfoTooltip } from '@/components/ui/MetricInfoTooltip'
import { getHotspotById } from '@/services/hotspotService'
import { CommandMap } from '@/components/map/CommandMap'
import { IntelligenceInsightCard } from '@/components/intelligence/IntelligenceInsightCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CommandButton } from '@/components/ui/CommandButton'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { StationPortalNavbar } from '@/components/layout/StationPortalNavbar'
import { formatStation } from '@/lib/formatters'
import { toCommandHotspot } from '@/lib/hotspots'
import { formatPeakViolationWindow } from '@/lib/timezone'
import { getHotspotPageTitle, getHotspotPageSubtitle } from '@/lib/hotspotLabels'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/AuthProvider'
import type { Classification } from '@/types/common'

export function StationHotspotDetailPage() {
  const { clusterId = '' } = useParams()
  const navigate = useNavigate()
  const { stationId } = useAuth()

  const { data: hotspot, isLoading, isError, refetch } = useQuery({
    queryKey: ['hotspot', clusterId],
    queryFn: () => getHotspotById(clusterId),
    enabled: !!clusterId,
  })

  const h = hotspot ? toCommandHotspot(hotspot) : null
  const cls = (hotspot?.classification ?? '').toUpperCase()

  // ── Station guard ────────────────────────────────────────────────────────────
  const stationMismatch =
    !isLoading &&
    hotspot &&
    hotspot.assigned_station &&
    stationId &&
    hotspot.assigned_station.toLowerCase() !== stationId.toLowerCase()

  if (stationMismatch) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6 py-16 text-center">
        <Crosshair className="mb-4 h-12 w-12 text-status-structural/60" />
        <p className="text-xl font-bold text-shell">Access denied</p>
        <p className="mt-2 max-w-xs text-sm text-shell-muted">
          Hotspot <span className="font-mono">{clusterId}</span> belongs to a different station.
        </p>
        <button
          type="button"
          onClick={() => navigate('/station-dashboard')}
          className="mt-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-5 py-2.5 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
        >
          Return to your portal
        </button>
      </div>
    )
  }

  const bigStats = [
    { label: 'Enforcement Priority', sub: 'ROI score', value: h?.roi.toFixed(1) ?? hotspot?.roi_score?.toFixed(1) ?? '—', tone: 'text-btp-cyan', help: 'Higher score means this hotspot should be handled earlier — more traffic-impact benefit per officer-hour.' },
    { label: 'Road Space Blocked', sub: 'LCLE %', value: h?.lcle != null ? `${h.lcle.toFixed(1)}%` : '—', tone: 'text-status-amber', help: 'Estimated road capacity blocked by parking pressure. Higher % = more severe.' },
    { label: 'Network Importance', sub: 'BCI', value: h?.bci != null ? h.bci.toFixed(4) : '—', tone: 'text-status-seasonal', help: 'How important this road segment is to surrounding routes. Higher = more disruptive if blocked.' },
  ]

  const meta = [
    { label: 'Assigned station', value: formatStation(hotspot?.assigned_station ?? stationId ?? '—') },
    { label: 'Road class', value: hotspot?.road_class ?? '—' },
    { label: 'Road width', value: hotspot?.road_width_m != null ? `${hotspot.road_width_m} m` : '—' },
    { label: 'OSM coverage', value: h?.osm_coverage != null ? `${(h.osm_coverage * 100).toFixed(0)}%` : '—' },
    { label: 'Violation Count', value: (hotspot?.violation_count ?? 0).toLocaleString('en-IN') },
    { label: 'Peak Violation Window', value: formatPeakViolationWindow(hotspot?.peak_window, 'labeled') ?? '—' },
    { label: 'Repeat Pressure', value: hotspot?.persistence != null ? String(hotspot.persistence) : '—' },
    { label: 'Recurrence Rate', value: hotspot?.recurrence != null ? String(hotspot.recurrence) : '—' },
  ]

  const backButton = (
    <Link to="/station-dashboard">
      <CommandButton variant="secondary" size="sm">
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </CommandButton>
    </Link>
  )

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <StationPortalNavbar stationLabel={stationId ? formatStation(stationId) : undefined} variant="detail" />

      {/* Page content — same container as AppShell uses */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="page-container">
          {isLoading && (
            <PageScaffold title={`Hotspot ${clusterId}`} eyebrow="Hotspot Intelligence" description="Loading cluster data…">
              <LoadingSkeleton lines={6} />
            </PageScaffold>
          )}

          {isError && (
            <PageScaffold title="Hotspot Detail" eyebrow="Hotspot Intelligence">
              <ErrorState onRetry={() => refetch()} />
            </PageScaffold>
          )}

          {!isLoading && !isError && !hotspot && (
            <PageScaffold title="Hotspot Detail" eyebrow="Hotspot Intelligence">
              <EmptyState title="Hotspot not found" description={`Cluster ${clusterId} not in dataset.`} />
            </PageScaffold>
          )}

          {hotspot && (
            <PageScaffold
              eyebrow="Hotspot Intelligence"
              title={h ? getHotspotPageTitle(h) : `Hotspot ${clusterId}`}
              description={h ? getHotspotPageSubtitle(h) : formatStation(hotspot.assigned_station ?? '—')}
              actions={backButton}
            >
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {cls === 'STRUCTURAL' || cls === 'RESPONSIVE' || cls === 'SEASONAL' ? (
                  <StatusBadge status={cls as Classification} />
                ) : null}
                {(h?.escalation_boost || (hotspot.feedback_structural_boost ?? 0) > 0) && (
                  <span className="rounded-full border border-status-structural/30 bg-status-structural/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-status-structural">
                    Feedback structural boost
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* left column */}
                <div className="space-y-4 lg:col-span-2">
                  <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-3">
                    {bigStats.map((s) => (
                      <motion.div
                        key={s.label}
                        variants={fadeUp}
                        className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 shadow-command backdrop-blur-xl"
                      >
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-civic-ivory/45">{s.label}</p>
                          <MetricInfoTooltip label={s.label}>{s.help}</MetricInfoTooltip>
                        </div>
                        <p className="text-[9px] text-civic-ivory/30">{s.sub}</p>
                        <p className={`mt-1.5 text-3xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
                      </motion.div>
                    ))}
                  </motion.div>

                  <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-5 backdrop-blur-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Recommended action</p>
                    <p className="mt-2 text-sm leading-relaxed text-shell">
                      {hotspot.recommended_action ?? '—'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-5 backdrop-blur-xl">
                    <p className="mb-3 text-sm font-bold text-civic-white">Road &amp; operational detail</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                      {meta.map((m) => (
                        <div key={m.label}>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-civic-ivory/45">{m.label}</dt>
                          <dd
                            className={cn(
                              'mt-0.5 text-sm font-semibold capitalize text-civic-white',
                              m.label === 'Peak violation window' ? 'whitespace-nowrap' : 'truncate',
                            )}
                          >
                            {m.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <IntelligenceInsightCard icon={Gauge} title="Road Space Blocked" tone="cyan">
                      <span className="font-semibold text-btp-cyan">LCLE</span> — Lane Clearance Loss Estimate. Estimates usable road capacity blocked by parking pressure.
                    </IntelligenceInsightCard>
                    <IntelligenceInsightCard icon={Network} title="Network Importance" tone="seasonal">
                      <span className="font-semibold text-status-seasonal">BCI</span> — Betweenness Centrality Index. Higher values mean disruptions here can affect more movement routes.
                    </IntelligenceInsightCard>
                    <IntelligenceInsightCard icon={TrendingUp} title="Enforcement Priority" tone="amber">
                      <span className="font-semibold text-status-amber">ROI score</span> — Impact per officer-hour. Where enforcement gives the strongest traffic benefit.
                    </IntelligenceInsightCard>
                  </div>
                </div>

                {/* right column: map */}
                <div className="space-y-4">
                  {h ? (
                    <div className="h-[260px]">
                      <CommandMap hotspots={[h]} selectedId={h.cluster_id} showRoute={false} className="h-full w-full" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/45 p-5 text-center">
                      <MapPin className="mx-auto mb-2 h-6 w-6 text-btp-cyan/50" />
                      <p className="text-sm text-civic-ivory/60">No coordinates available for this cluster.</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-4 backdrop-blur-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Coordinates</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-civic-white">
                      {hotspot.centroid_lat != null && hotspot.centroid_lng != null
                        ? `${hotspot.centroid_lat.toFixed(5)}, ${hotspot.centroid_lng.toFixed(5)}`
                        : '—'}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-btp-cyan/55">{clusterId}</p>
                    <p className="mt-3 text-[11px] leading-relaxed text-civic-ivory/55">
                      Operational note: classification and recommended action are derived from LCLE, BCI, ROI,
                      persistence, and recurrence. Verify on-ground before enforcement dispatch.
                    </p>
                  </div>
                </div>
              </div>
            </PageScaffold>
          )}
        </div>
      </main>
    </div>
  )
}
