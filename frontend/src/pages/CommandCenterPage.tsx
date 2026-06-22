import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, Layers, MapPin, Sparkles, Target } from 'lucide-react'
import { getSummary } from '@/services/summaryService'
import { getAgentState } from '@/services/agentService'
import { getInfraEscalationCandidates } from '@/services/infraService'
import { getRoutes } from '@/services/routeService'
import { CommandMap } from '@/components/map/CommandMap'
import { MapControls, type ClassFilter } from '@/components/command/MapControls'
import { TopHotspotsPanel } from '@/components/command/TopHotspotsPanel'
import { SelectedHotspotCard } from '@/components/command/SelectedHotspotCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { useApiHealth } from '@/hooks/useApiHealth'
import { cn } from '@/lib/cn'
import { fadeUp, scaleIn, staggerContainer } from '@/lib/motion'
import { type CommandHotspot } from '@/lib/hotspots'
import { sortHotspotsByMapPriority } from '@/lib/mapMarkerStrategy'
import { toRouteLine } from '@/lib/routes'
import { formatRelativeTime } from '@/lib/formatters'
import { useHotspots } from '@/hooks/useHotspots'

export function CommandCenterPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [station, setStation] = useState('ALL')
  const [classification, setClassification] = useState<ClassFilter>('ALL')
  const [showHotspots, setShowHotspots] = useState(true)
  const [showRoute, setShowRoute] = useState(true)
  const [escalationOnly, setEscalationOnly] = useState(false)

  const { label: apiLabel, status: apiStatus } = useApiHealth()

  const summaryQ = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const { hotspots: allHotspots, isLoading: hotspotsLoading } = useHotspots()
  const agentQ = useQuery({ queryKey: ['agentState'], queryFn: getAgentState })
  const infraQ = useQuery({ queryKey: ['infra'], queryFn: getInfraEscalationCandidates })
  const routesQ = useQuery({ queryKey: ['routes'], queryFn: getRoutes })

  const summary = summaryQ.data
  const routes = useMemo(() => routesQ.data?.routes ?? [], [routesQ.data])

  const stations = useMemo(
    () => Array.from(new Set(allHotspots.map((h) => h.station))).filter((s) => s && s !== '—').sort(),
    [allHotspots],
  )

  const filtered = useMemo(() => {
    return allHotspots.filter((h) => {
      if (station !== 'ALL' && h.station !== station) return false
      if (classification !== 'ALL' && h.classification !== classification) return false
      if (escalationOnly && !h.escalation_boost) return false
      return true
    })
  }, [allHotspots, station, classification, escalationOnly])

  const topList = useMemo(() => sortHotspotsByMapPriority(filtered).slice(0, 10), [filtered])

  const mapFitKey = `${station}|${classification}|${escalationOnly ? 'esc' : 'all'}`

  const selectedHotspot = useMemo<CommandHotspot | null>(
    () => allHotspots.find((h) => h.cluster_id === selectedId) ?? null,
    [allHotspots, selectedId],
  )

  const activeRoute = useMemo(() => {
    if (routes.length === 0) return null
    const target = selectedHotspot
      ? routes.find(
          (r) => (r.assigned_station ?? '').toUpperCase() === selectedHotspot.station.toUpperCase(),
        )
      : undefined
    return toRouteLine(target ?? routes[0])
  }, [routes, selectedHotspot])

  const escalationReady = useMemo(
    () => infraQ.data?.filter((c) => c.infra_escalation_ready === 1).length ?? 0,
    [infraQ.data],
  )

  const routingMode = String(
    summary?.routing_mode ?? (routesQ.data?.metadata?.routing_mode_used as string) ?? '—',
  )

  const agentData = agentQ.data?.data as Record<string, unknown> | null | undefined
  const lastRunTs = agentData?.last_run_timestamp ? String(agentData.last_run_timestamp) : null

  const handleReset = () => {
    setStation('ALL')
    setClassification('ALL')
    setEscalationOnly(false)
    setShowHotspots(true)
    setShowRoute(true)
    setSelectedId(null)
  }

  const kpis = [
    { label: 'Total Hotspots', value: summary?.total_hotspots ?? allHotspots.length, icon: MapPin, tone: 'blue' as const },
    { label: 'Structural Issue', value: summary?.structural_count ?? 0, icon: AlertTriangle, tone: 'structural' as const },
    { label: 'Patrol-Responsive', value: summary?.responsive_count ?? 0, icon: Sparkles, tone: 'cyan' as const },
    { label: 'Seasonal Pattern', value: summary?.seasonal_count ?? 0, icon: Layers, tone: 'seasonal' as const },
    { label: "Today's Assignments", value: summary?.total_assignments ?? 0, icon: Clock, tone: 'amber' as const },
    { label: 'Escalation', value: escalationReady, icon: Target, tone: 'structural' as const },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3 border-b border-btp-cyan/12 pb-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-btp-cyan">
            <span className="h-1 w-1 rounded-full bg-btp-cyan shadow-glow-cyan" />
            Command Center
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-civic-white sm:text-[1.75rem]">
            Bengaluru Parking Impact Command
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-civic-ivory/60">
            Map-first operational dashboard for ROI-ranked illegal-parking hotspots, patrol routes,
            and structural escalation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderChip
            dot={apiStatus === 'connected' ? 'bg-status-cleared' : apiStatus === 'offline' ? 'bg-status-structural' : 'bg-status-amber'}
            label={apiLabel}
          />
          <HeaderChip dot="bg-status-amber" label={`Plan: ${summary?.plan_status ?? '—'}`} />
          <HeaderChip dot="bg-status-route" label={`Routing: ${routingMode}`} />
          {lastRunTs && <HeaderChip dot="bg-btp-cyan" label={formatRelativeTime(lastRunTs)} />}
        </div>
      </motion.header>

      {/* KPI row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {kpis.map((k, i) => (
          <MetricCard key={k.label} index={i} label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
        ))}
      </motion.div>

      {/* Main operational area */}
      <div className="grid gap-4 lg:h-[clamp(380px,54vh,580px)] lg:grid-cols-3">
        {/* Map column */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="flex min-h-0 flex-col gap-2.5 lg:col-span-2"
        >
          <MapControls
            stations={stations}
            station={station}
            onStation={setStation}
            classification={classification}
            onClassification={setClassification}
            showHotspots={showHotspots}
            onToggleHotspots={() => setShowHotspots((v) => !v)}
            showRoute={showRoute}
            onToggleRoute={() => setShowRoute((v) => !v)}
            escalationOnly={escalationOnly}
            onToggleEscalation={() => setEscalationOnly((v) => !v)}
            onReset={handleReset}
          />
          <div className="relative h-[320px] sm:h-[380px] lg:h-auto lg:min-h-0 lg:flex-1">
            <CommandMap
              hotspots={filtered}
              route={activeRoute}
              selectedId={selectedId}
              showHotspots={showHotspots}
              showRoute={showRoute}
              onSelect={setSelectedId}
              className="h-full w-full"
              smartRender
              isAllStations={station === 'ALL'}
              fitKey={mapFitKey}
            />
            {hotspotsLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-civic-dusk/70 text-xs text-civic-ivory/70">
                Loading hotspots…
              </div>
            )}
          </div>
        </motion.div>

        {/* Right column */}
        <div className="flex min-h-0 flex-col gap-3">
          <SelectedHotspotCard hotspot={selectedHotspot} />
          <TopHotspotsPanel
            hotspots={topList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={hotspotsLoading}
            className="h-[340px] lg:h-auto lg:min-h-0 lg:flex-1"
          />
        </div>
      </div>
    </div>
  )
}

function HeaderChip({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-btp-cyan/15 bg-civic-navy/55 px-2.5 py-1 text-[10px] font-semibold capitalize text-civic-ivory/75 backdrop-blur-sm">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}
