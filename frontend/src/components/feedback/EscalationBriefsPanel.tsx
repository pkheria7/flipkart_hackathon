import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, FileText, FileWarning } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { API_BASE_URL } from '@/services/config'
import { staggerContainer, fadeUp, slideInRight } from '@/lib/motion'
import type { InfraCandidateApi, InfraPdfItem } from '@/types/api'

interface EscalationBriefsPanelProps {
  candidates: InfraCandidateApi[]
  pdfs: InfraPdfItem[]
  isLoading?: boolean
  stationLookup?: (clusterId: string) => string | undefined
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EscalationBriefsPanel({ candidates, pdfs, isLoading, stationLookup }: EscalationBriefsPanelProps) {
  const ordered = useMemo(
    () =>
      [...candidates].sort(
        (a, b) => (b.infra_escalation_ready ?? 0) - (a.infra_escalation_ready ?? 0),
      ),
    [candidates],
  )
  const readyCount = ordered.filter((c) => c.infra_escalation_ready === 1).length

  if (isLoading) return <LoadingSkeleton lines={6} />

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* candidates */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-civic-white">
          <FileWarning className="h-4 w-4 text-status-structural" />
          Escalation candidates
          <span className="rounded-full border border-status-structural/30 bg-status-structural/12 px-2 py-0.5 text-[10px] font-bold text-status-structural">
            {readyCount} ready
          </span>
        </p>

        {ordered.length === 0 ? (
          <EmptyCard text="No escalation candidates found. Infra assessment summary may be missing." />
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2.5">
            {ordered.slice(0, 20).map((c) => {
              const ready = c.infra_escalation_ready === 1
              const station = stationLookup?.(c.cluster_id)
              return (
                <motion.div
                  key={c.cluster_id}
                  variants={fadeUp}
                  className={cn(
                    'rounded-xl border border-l-4 bg-civic-navy/55 p-3 backdrop-blur-xl',
                    ready ? 'border-btp-cyan/12 !border-l-status-structural' : 'border-btp-cyan/12 !border-l-civic-ivory/25',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-civic-white">{c.cluster_id}</span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        ready
                          ? 'border-status-structural/30 bg-status-structural/15 text-status-structural'
                          : 'border-civic-ivory/20 bg-civic-white/5 text-civic-ivory/55',
                      )}
                    >
                      {ready ? 'Escalation ready' : 'Monitoring'}
                    </span>
                  </div>
                  {station && <p className="mt-0.5 text-[11px] text-civic-ivory/50">{station}</p>}
                  {c.infra_dominant_cause && (
                    <p className="mt-1.5 text-[11px] text-civic-ivory/65">
                      <span className="text-civic-ivory/45">Cause: </span>
                      {c.infra_dominant_cause}
                    </p>
                  )}
                  {c.infra_suggested_fix && (
                    <p className="text-[11px] text-civic-ivory/65">
                      <span className="text-civic-ivory/45">Fix: </span>
                      {c.infra_suggested_fix}
                    </p>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* PDFs */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-civic-white">
          <FileText className="h-4 w-4 text-btp-cyan" />
          Generated PDF briefs
          <span className="rounded-full border border-btp-cyan/25 bg-btp-cyan/10 px-2 py-0.5 text-[10px] font-bold text-btp-cyan">
            {pdfs.length}
          </span>
        </p>

        {pdfs.length === 0 ? (
          <EmptyCard text="No PDF briefs generated yet. Briefs appear here once the M15 infra exporter runs." />
        ) : (
          <div className="space-y-2.5">
            {pdfs.map((pdf, i) => (
              <motion.a
                key={pdf.filename}
                href={`${API_BASE_URL}${pdf.url}`}
                target="_blank"
                rel="noreferrer"
                variants={slideInRight}
                initial="hidden"
                animate="visible"
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-civic-ink/10 bg-civic-white p-3 shadow-soft transition-shadow hover:shadow-glow-cyan"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-structural/10">
                    <FileText className="h-5 w-5 text-status-structural" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-civic-ink">{pdf.filename}</span>
                    <span className="block text-[11px] text-civic-graphite">{formatBytes(pdf.size)}</span>
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-btp-signal">
                  Open PDF
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-8 text-center text-xs text-civic-ivory/55">
      {text}
    </div>
  )
}
