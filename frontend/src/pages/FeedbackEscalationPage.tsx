import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, FileText, FileWarning, RefreshCw, ShieldAlert, Target } from 'lucide-react'
import { useHotspots } from '@/hooks/useHotspots'
import { getFeedbackForCluster } from '@/services/feedbackService'
import { getInfraEscalationCandidates, getInfraPdfs } from '@/services/infraService'
import { getSummary } from '@/services/summaryService'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { ModuleTabs } from '@/components/ui/ModuleTabs'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { formatStation } from '@/lib/formatters'
import type { Classification } from '@/types/common'
import { FeedbackHotspotSelector } from '@/components/feedback/FeedbackHotspotSelector'
import { OfficerFeedbackForm } from '@/components/feedback/OfficerFeedbackForm'
import { CitizenFeedbackForm } from '@/components/feedback/CitizenFeedbackForm'
import { StructuralBoostPanel } from '@/components/feedback/StructuralBoostPanel'
import { EscalationBriefsPanel } from '@/components/feedback/EscalationBriefsPanel'
import { FeedbackHistoryPanel } from '@/components/feedback/FeedbackHistoryPanel'

export function FeedbackEscalationPage() {
  const { hotspots, isLoading: hotspotsLoading } = useHotspots()
  const infraQ = useQuery({ queryKey: ['infra'], queryFn: getInfraEscalationCandidates })
  const pdfsQ = useQuery({ queryKey: ['infraPdfs'], queryFn: getInfraPdfs })
  const summaryQ = useQuery({ queryKey: ['summary'], queryFn: getSummary })

  const [searchParams] = useSearchParams()
  const validTabs = ['officer', 'citizen', 'boost', 'briefs']
  const requestedTab = searchParams.get('tab')

  const [clusterId, setClusterId] = useState('')
  const [activeTab, setActiveTab] = useState(
    requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'officer',
  )
  const [recurredTrigger, setRecurredTrigger] = useState(0)

  // Default to first STRUCTURAL hotspot, else highest ROI.
  useEffect(() => {
    if (clusterId || hotspots.length === 0) return
    const structural = hotspots.find((h) => h.classification === 'STRUCTURAL')
    setClusterId((structural ?? hotspots[0]).cluster_id)
  }, [hotspots, clusterId])

  const selected = useMemo(
    () => hotspots.find((h) => h.cluster_id === clusterId) ?? null,
    [hotspots, clusterId],
  )

  const feedbackQ = useQuery({
    queryKey: ['feedback', clusterId],
    queryFn: () => getFeedbackForCluster(clusterId),
    enabled: !!clusterId,
  })

  const summary = feedbackQ.data?.summary ?? null

  const stationByCluster = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of hotspots) map.set(h.cluster_id, h.station)
    return map
  }, [hotspots])

  const candidates = infraQ.data ?? []
  const pdfs = pdfsQ.data ?? []
  const readyCount = candidates.filter((c) => c.infra_escalation_ready === 1).length
  const structuralCount =
    summaryQ.data?.structural_count ?? hotspots.filter((h) => h.classification === 'STRUCTURAL').length
  const clusterEvents = (summary?.officer_event_count ?? 0) + (summary?.citizen_event_count ?? 0)
  const recurred = summary?.recurred_after_enforcement_count ?? 0

  const onRecurred = (didRecur: boolean) => {
    if (didRecur) {
      setRecurredTrigger((n) => n + 1)
      setActiveTab('boost')
    }
  }

  const kpis = [
    { label: 'Escalation candidates', value: String(readyCount), icon: FileWarning, tone: 'red' as const },
    { label: 'PDF briefs', value: String(pdfs.length), icon: FileText, tone: 'cyan' as const },
    { label: 'Structural-issue hotspots', value: String(structuralCount), icon: ShieldAlert, tone: 'red' as const },
    { label: 'Cluster feedback', value: String(clusterEvents), icon: Activity, tone: 'cyan' as const },
    { label: 'Recurrence signal', value: String(recurred), icon: RefreshCw, tone: 'amber' as const },
    { label: 'Selected hotspot', value: clusterId || '—', icon: Target, tone: 'cyan' as const },
  ]

  return (
    <PageScaffold
      eyebrow="Learning Loop"
      title="Feedback & Structural Escalation"
      description="Capture enforcement outcomes, detect recurring hotspots, and turn repeated failure into BBMP/BTP infrastructure briefs."
      actions={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <StatusChip label="Feedback DB" value={feedbackQ.data?.ok ? 'Ready' : '—'} tone="cyan" />
          <StatusChip label="Candidates" value={`${readyCount} ready`} tone="red" />
          <StatusChip label="PDF briefs" value={String(pdfs.length)} tone="cyan" />
          <StatusChip label="Source" value="frontend_demo" tone="muted" />
        </div>
      }
    >
      {/* KPI row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <motion.div key={k.label} variants={fadeUp} className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-3.5 backdrop-blur-xl">
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">
                <Icon className={cn('h-3 w-3', k.tone === 'red' ? 'text-status-structural' : k.tone === 'amber' ? 'text-status-amber' : 'text-btp-cyan')} />
                {k.label}
              </p>
              <p className="mt-1.5 truncate text-xl font-bold text-civic-white">{k.value}</p>
            </motion.div>
          )
        })}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* left: selector + tabs */}
        <div className="space-y-4 lg:col-span-2">
          <FeedbackHotspotSelector
            hotspots={hotspots}
            value={clusterId}
            onChange={setClusterId}
            isLoading={hotspotsLoading}
          />

          {clusterId ? (
            <ModuleTabs
              active={activeTab}
              onTabChange={setActiveTab}
              layoutId="feedback-tab"
              tabs={[
                {
                  id: 'officer',
                  label: 'Officer Feedback',
                  content: (
                    <OfficerFeedbackForm clusterId={clusterId} station={selected?.station} onSubmitted={onRecurred} />
                  ),
                },
                {
                  id: 'citizen',
                  label: 'Citizen Reason Capture',
                  content: <CitizenFeedbackForm clusterId={clusterId} station={selected?.station} />,
                },
                {
                  id: 'boost',
                  label: 'Structural Boost',
                  content: (
                    <StructuralBoostPanel
                      hotspot={selected}
                      summary={summary}
                      isLoading={feedbackQ.isLoading}
                      externalTrigger={recurredTrigger}
                    />
                  ),
                },
                {
                  id: 'briefs',
                  label: 'Escalation Briefs',
                  content: (
                    <EscalationBriefsPanel
                      candidates={candidates}
                      pdfs={pdfs}
                      isLoading={infraQ.isLoading || pdfsQ.isLoading}
                      stationLookup={(id) => stationByCluster.get(id)}
                    />
                  ),
                },
              ]}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center text-sm text-civic-ivory/55">
              Select a hotspot to begin capturing feedback.
            </div>
          )}
        </div>

        {/* right: selected context + history */}
        <div className="space-y-4">
          <SelectedContext
            clusterId={clusterId}
            station={selected?.station ?? null}
            classification={selected?.classification ?? null}
            roi={selected?.roi ?? null}
            lcle={selected?.lcle ?? null}
            bci={selected?.bci ?? null}
            boost={summary?.feedback_structural_boost === 1}
          />
          <FeedbackHistoryPanel feedback={feedbackQ.data ?? null} isLoading={feedbackQ.isLoading} />
        </div>
      </div>
    </PageScaffold>
  )
}

function SelectedContext({
  clusterId,
  station,
  classification,
  roi,
  lcle,
  bci,
  boost,
}: {
  clusterId: string
  station: string | null
  classification: Classification | 'UNKNOWN' | null
  roi: number | null
  lcle: number | null
  bci: number | null
  boost: boolean
}) {
  if (!clusterId) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-6 text-center text-xs text-civic-ivory/55">
        No hotspot selected.
      </div>
    )
  }
  const known = classification && classification !== 'UNKNOWN'
  const stats: Array<{ label: string; sub: string; value: string }> = [
    { label: 'Priority', sub: 'ROI', value: roi != null ? roi.toFixed(1) : '—' },
    { label: 'Road Blocked', sub: 'LCLE', value: lcle != null ? `${lcle.toFixed(1)}%` : '—' },
    { label: 'Network', sub: 'BCI', value: bci != null ? bci.toFixed(3) : '—' },
  ]
  return (
    <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-btp-cyan">Selected hotspot</p>
          <p className="truncate text-base font-bold text-civic-white">{clusterId}</p>
          <p className="truncate text-xs text-civic-ivory/55">{station ? formatStation(station) : 'Station unknown'}</p>
        </div>
        {known ? (
          <StatusBadge status={classification as Classification} />
        ) : (
          <span className="rounded-full border border-civic-ivory/20 px-2 py-0.5 text-[9px] font-bold uppercase text-civic-ivory/55">
            N/A
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-btp-cyan/12 bg-civic-dusk/55 px-2 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">{s.label}</p>
            <p className="text-[7px] text-civic-ivory/30">{s.sub}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-civic-white">{s.value}</p>
          </div>
        ))}
      </div>
      {boost && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-status-structural/25 bg-status-structural/10 px-3 py-2 text-[11px] font-semibold text-status-structural">
          <ShieldAlert className="h-3.5 w-3.5" />
          Structural boost signal active for this cluster.
        </p>
      )}
    </div>
  )
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'cyan' | 'red' | 'muted'
}) {
  const toneClass = {
    amber: 'border-status-amber/30 bg-status-amber/12 text-status-amber',
    cyan: 'border-btp-cyan/25 bg-btp-cyan/10 text-btp-cyan',
    red: 'border-status-structural/30 bg-status-structural/12 text-status-structural',
    muted: 'border-civic-white/12 bg-civic-white/5 text-civic-ivory/65',
  }[tone]
  return (
    <div className={cn('rounded-xl border px-3 py-1.5 backdrop-blur-xl', toneClass)}>
      <p className="text-[8px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  )
}
