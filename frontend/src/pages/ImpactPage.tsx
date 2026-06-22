import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarRange, ChevronDown, ClipboardList } from 'lucide-react'
import { getHotspots } from '@/services/hotspotService'
import { getInfraPdfs } from '@/services/infraService'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ReviewNoteBanner } from '@/components/impact/ReviewNoteBanner'
import { OfficerSummaryPanel } from '@/components/impact/OfficerSummaryPanel'
import { ImpactSummaryCards } from '@/components/impact/ImpactSummaryCards'
import { WeekComparison } from '@/components/impact/WeekComparison'
import { ImpactTrendChart } from '@/components/impact/ImpactTrendChart'
import { EvidenceClusterTable } from '@/components/impact/EvidenceClusterTable'
import { ValidationCards } from '@/components/impact/ValidationCards'
import { BriefReadinessCard } from '@/components/impact/BriefReadinessCard'
import { generateImpactEvidence, type HotspotLike } from '@/data/impactEvidenceData'
import { formatStation } from '@/lib/formatters'
import { cn } from '@/lib/cn'

function SectionLabel({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-btp-cyan">{eyebrow}</p>
      <h2 className="font-display text-lg font-bold text-shell">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-shell-muted">{hint}</p>}
    </div>
  )
}

export function ImpactPage() {
  const [station, setStation] = useState('ALL')
  const [showDetails, setShowDetails] = useState(false)

  const hotspotsQ = useQuery({ queryKey: ['hotspots'], queryFn: () => getHotspots() })
  // Same query key as Feedback & Escalation → shared cache, identical PDF count.
  const pdfsQ = useQuery({ queryKey: ['infraPdfs'], queryFn: getInfraPdfs })
  const generatedPdfs = pdfsQ.data?.length ?? 0

  const stationOptions = useMemo(() => {
    const set = new Set<string>()
    for (const h of hotspotsQ.data ?? []) {
      if (h.assigned_station) set.add(h.assigned_station)
    }
    return ['ALL', ...Array.from(set).sort()]
  }, [hotspotsQ.data])

  const data = useMemo(() => {
    const all = (hotspotsQ.data ?? []) as HotspotLike[]
    const filtered = station === 'ALL' ? all : all.filter((h) => h.assigned_station === station)
    return generateImpactEvidence(`impact|${station}|week2`, filtered)
  }, [hotspotsQ.data, station])

  return (
    <PageScaffold
      eyebrow="Enforcement Impact"
      title="Enforcement Impact Review"
      description="Review hotspot pressure changes, recurring clusters, and recommended next actions for enforcement planning."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-btp-cyan/20 bg-civic-navy/55 px-2.5 py-1 text-[10px] font-semibold text-shell-muted">
            <CalendarRange className="h-3 w-3 text-btp-cyan" />
            Week 1 vs Week 2
          </span>
          <div className="relative">
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="focus-ring-command cursor-pointer appearance-none rounded-lg border border-btp-cyan/15 bg-civic-navy/60 py-1.5 pl-3 pr-8 text-xs font-semibold text-shell"
              aria-label="Filter by station"
            >
              {stationOptions.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All stations' : formatStation(s)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-shell-muted" />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <ReviewNoteBanner />

        {hotspotsQ.isLoading ? (
          <LoadingSkeleton lines={6} />
        ) : (
          <>
            {/* ───────── Officer Action Brief ───────── */}
            <section aria-label="Officer action brief">
              <OfficerSummaryPanel insights={data.insights} actions={data.recommendedActions} />
            </section>

            {/* ───────── KPI row ───────── */}
            <section aria-label="Key indicators">
              <SectionLabel eyebrow="At a glance" title="Impact this window" hint="Key enforcement indicators" />
              <ImpactSummaryCards kpis={data.kpis} />
            </section>

            {/* ───────── Details toggle ───────── */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="focus-ring-command inline-flex items-center gap-2 rounded-xl border border-btp-cyan/20 bg-civic-navy/55 px-4 py-2 text-sm font-semibold text-shell transition-colors hover:border-btp-cyan/40"
                aria-expanded={showDetails}
              >
                {showDetails ? 'Hide detailed evidence' : 'View detailed evidence'}
                <ChevronDown className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')} />
              </button>
            </div>

            {/* ───────── Detailed evidence (collapsed by default) ───────── */}
            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-8 overflow-hidden"
                >
                  <section aria-label="Week comparison" className="pt-2">
                    <SectionLabel
                      eyebrow="Window comparison"
                      title="Week 1 vs Week 2"
                      hint="Baseline window vs prioritised-patrol enforcement window"
                    />
                    <WeekComparison week1={data.week1} week2={data.week2} />
                  </section>

                  <section aria-label="Trend">
                    <SectionLabel eyebrow="Trend" title="Pressure trajectory" />
                    <ImpactTrendChart trend={data.trend} />
                  </section>

                  <section aria-label="Evidence clusters">
                    <SectionLabel
                      eyebrow="Evidence"
                      title="Cluster-level evidence"
                      hint="Sorted by escalation priority, then biggest pressure improvement"
                    />
                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="xl:col-span-2">
                        <EvidenceClusterTable clusters={data.clusters} />
                      </div>
                      <BriefReadinessCard readiness={data.briefReadiness} generatedPdfs={generatedPdfs} />
                    </div>
                  </section>

                  <section aria-label="Review checks">
                    <SectionLabel
                      eyebrow="Credibility"
                      title="How this review is checked"
                      hint="What is measured, what is recurring, and what still needs field review"
                    />
                    <ValidationCards />
                  </section>

                  {/* Method note — honest methodology, kept off the first screen */}
                  <details className="group rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-4 py-3 shadow-soft backdrop-blur-xl">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-shell">
                      <ClipboardList className="h-4 w-4 text-btp-cyan" />
                      Method note
                      <ChevronDown className="ml-auto h-4 w-4 text-shell-muted transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-shell-muted">
                      This prototype review uses violation records, recurrence patterns, and demo
                      enforcement-window assumptions. Final operational validation should be done
                      using field reports and post-enforcement observations.
                    </p>
                  </details>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </PageScaffold>
  )
}
