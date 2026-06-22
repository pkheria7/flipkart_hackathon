import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { type CommandHotspot } from '@/lib/hotspots'
import { getHotspotSummary } from '@/services/hotspotService'
import { getSummary } from '@/services/summaryService'
import { getInfraEscalationCandidates } from '@/services/infraService'
import { useApiHealth } from '@/hooks/useApiHealth'
import { useHotspots } from '@/hooks/useHotspots'
import { formatNumber } from '@/lib/formatters'
import { ModuleTabs } from '@/components/ui/ModuleTabs'
import { HotspotFilterBar, type ClassFilter, type SortMode } from '@/components/intelligence/HotspotFilterBar'
import { PriorityBoard } from '@/components/intelligence/PriorityBoard'
import { HotspotInspector } from '@/components/intelligence/HotspotInspector'

export function IntelligencePage() {
  const [activeTab, setActiveTab] = useState('priority')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [station, setStation] = useState('ALL')
  const [classification, setClassification] = useState<ClassFilter>('ALL')
  const [roadClass, setRoadClass] = useState('ALL')
  const [sortMode, setSortMode] = useState<SortMode>('roi_score')
  const [search, setSearch] = useState('')

  const { label: apiLabel, status: apiStatus } = useApiHealth()

  const { hotspots: allHotspots, isLoading: hotspotsLoading } = useHotspots()
  const summaryQ = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const hotspotSummaryQ = useQuery({ queryKey: ['hotspotSummary'], queryFn: getHotspotSummary })
  useQuery({ queryKey: ['infra'], queryFn: getInfraEscalationCandidates })

  const summary = summaryQ.data
  const hsSummary = hotspotSummaryQ.data

  const stations = useMemo(
    () => Array.from(new Set(allHotspots.map((h) => h.station))).filter((s) => s && s !== '—').sort(),
    [allHotspots],
  )
  const roadClasses = useMemo(
    () =>
      Array.from(new Set(allHotspots.map((h) => h.road_class).filter((r): r is string => !!r))).sort(),
    [allHotspots],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allHotspots.filter((h) => {
      if (station !== 'ALL' && h.station !== station) return false
      if (classification !== 'ALL' && h.classification !== classification) return false
      if (roadClass !== 'ALL' && h.road_class !== roadClass) return false
      if (q) {
        const hay = `${h.cluster_id} ${h.station} ${h.road_class ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allHotspots, station, classification, roadClass, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => (sortMode === 'roi_score' ? b.roi - a.roi : b.violations - a.violations))
    return list
  }, [filtered, sortMode])

  const selectedHotspot = useMemo<CommandHotspot | null>(
    () => allHotspots.find((h) => h.cluster_id === selectedId) ?? null,
    [allHotspots, selectedId],
  )

  const handleInspect = (id: string) => {
    setSelectedId(id)
    setActiveTab('inspector')
  }

  const kpis = [
    { label: 'Total Hotspots', value: summary?.total_hotspots ?? hsSummary?.total_hotspots ?? allHotspots.length, tone: 'text-btp-cyan' },
    { label: 'Structural Issue', value: summary?.structural_count ?? hsSummary?.classification_counts?.STRUCTURAL ?? 0, tone: 'text-status-structural' },
    { label: 'Patrol-Responsive', value: summary?.responsive_count ?? hsSummary?.classification_counts?.RESPONSIVE ?? 0, tone: 'text-btp-cyan' },
    { label: 'Seasonal Pattern', value: summary?.seasonal_count ?? hsSummary?.classification_counts?.SEASONAL ?? 0, tone: 'text-status-seasonal' },
    { label: 'Avg Priority', value: fmt(summary?.average_roi ?? hsSummary?.average_roi_score), tone: 'text-btp-cyan' },
    { label: 'Avg Road Blocked', value: fmt(summary?.average_lcle ?? hsSummary?.average_lcle, '%'), tone: 'text-status-amber' },
    { label: 'Avg Network', value: fmt(summary?.average_bci ?? hsSummary?.average_bci, '', 3), tone: 'text-status-seasonal' },
    { label: 'Total Violations', value: (summary?.total_violations ?? hsSummary?.total_violations ?? 0).toLocaleString('en-IN'), tone: 'text-status-amber' },
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
            Hotspot Intelligence
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-civic-white sm:text-[1.75rem]">
            Traffic-Impact Priority Board
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-civic-ivory/60">
            Rank and inspect hotspots by enforcement priority, road blockage, and violation signals. Peak
            violation windows are based on challan record activity. Use Command Center for the live
            city map and patrol overlay.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-btp-cyan/15 bg-civic-navy/55 px-2.5 py-1 text-[10px] font-semibold text-civic-ivory/75 backdrop-blur-sm lg:self-auto">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              apiStatus === 'connected' ? 'bg-status-cleared' : apiStatus === 'offline' ? 'bg-status-structural' : 'bg-status-amber',
            )}
          />
          {apiLabel}
        </span>
      </motion.header>

      {/* KPI row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8"
      >
        {kpis.map((k) => (
          <motion.div
            key={k.label}
            variants={fadeUp}
            className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-3 py-2.5 backdrop-blur-xl"
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">{k.label}</p>
            <p className={cn('mt-1 text-lg font-bold tabular-nums', k.tone)}>{k.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filter bar */}
      <HotspotFilterBar
        stations={stations}
        roadClasses={roadClasses}
        station={station}
        onStation={setStation}
        classification={classification}
        onClassification={setClassification}
        roadClass={roadClass}
        onRoadClass={setRoadClass}
        sortMode={sortMode}
        onSortMode={setSortMode}
        search={search}
        onSearch={setSearch}
      />

      {/* Tabs */}
      <ModuleTabs
        active={activeTab}
        onTabChange={setActiveTab}
        layoutId="intel-tab-active"
        tabs={[
          {
            id: 'priority',
            label: 'Priority Board',
            content: (
              <PriorityBoard
                hotspots={sorted}
                sortMode={sortMode}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onInspect={handleInspect}
                isLoading={hotspotsLoading}
              />
            ),
          },
          {
            id: 'inspector',
            label: 'Hotspot Inspector',
            content: <HotspotInspector hotspot={selectedHotspot} />,
          },
        ]}
      />
    </div>
  )
}

function fmt(value: number | null | undefined, suffix = '', decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatNumber(value, decimals)}${suffix}`
}
