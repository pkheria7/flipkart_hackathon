import { useEffect, useState } from 'react'
import { Sparkles, Target } from 'lucide-react'
import { CommandButton } from '@/components/ui/CommandButton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { FeedbackBoostAnimation } from '@/components/motion/FeedbackBoostAnimation'
import { formatStation } from '@/lib/formatters'
import type { CommandHotspot } from '@/lib/hotspots'
import type { FeedbackSummary } from '@/types/feedback'
import type { Classification } from '@/types/common'

interface StructuralBoostPanelProps {
  hotspot: CommandHotspot | null
  summary: FeedbackSummary | null
  isLoading?: boolean
  /** Bumped by parent when a "recurred" officer feedback was just submitted. */
  externalTrigger?: number
}

function metric(value: number | null | undefined, digits = 1, suffix = ''): string {
  return value == null ? '—' : `${value.toFixed(digits)}${suffix}`
}

export function StructuralBoostPanel({ hotspot, summary, isLoading, externalTrigger }: StructuralBoostPanelProps) {
  const [preview, setPreview] = useState(false)

  // A "recurred" submission from the officer form auto-activates the preview.
  useEffect(() => {
    if (externalTrigger && externalTrigger > 0) setPreview(true)
  }, [externalTrigger])

  // Reset preview when the selected cluster changes.
  useEffect(() => {
    setPreview(false)
  }, [hotspot?.cluster_id])

  if (isLoading) return <LoadingSkeleton lines={6} />

  if (!hotspot) {
    return (
      <div className="rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 p-10 text-center">
        <Target className="mx-auto mb-3 h-8 w-8 text-btp-cyan/50" />
        <p className="text-sm font-semibold text-civic-white">Select a hotspot to inspect its boost signal.</p>
      </div>
    )
  }

  const backendBoost = summary?.feedback_structural_boost === 1
  const active = backendBoost || preview
  const known = hotspot.classification !== 'UNKNOWN'

  const metrics: Array<{ label: string; sub?: string; value: string }> = [
    { label: 'Priority', sub: 'ROI', value: metric(hotspot.roi) },
    { label: 'Road Blocked', sub: 'LCLE', value: metric(hotspot.lcle, 1, '%') },
    { label: 'Network', sub: 'BCI', value: metric(hotspot.bci, 3) },
    { label: 'Officer events', value: String(summary?.officer_event_count ?? 0) },
    { label: 'Citizen events', value: String(summary?.citizen_event_count ?? 0) },
    { label: 'Recurred', value: String(summary?.recurred_after_enforcement_count ?? 0) },
  ]

  return (
    <div className="space-y-4">
      <FeedbackBoostAnimation active={active} preview={preview && !backendBoost} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-btp-cyan/15 bg-civic-navy/55 p-4 backdrop-blur-xl lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-civic-white">{hotspot.cluster_id}</p>
            {known ? (
              <StatusBadge status={hotspot.classification as Classification} />
            ) : (
              <span className="rounded-full border border-civic-ivory/20 px-2 py-0.5 text-[9px] font-bold uppercase text-civic-ivory/55">
                Unclassified
              </span>
            )}
          </div>
          <p className="text-xs text-civic-ivory/55">{formatStation(hotspot.station)}</p>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-btp-cyan/12 bg-civic-dusk/60 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-civic-ivory/50">Boost signal</span>
            {active ? (
              <span className="rounded-full border border-status-structural/30 bg-status-structural/15 px-2 py-0.5 text-[10px] font-bold uppercase text-status-structural">
                {backendBoost ? 'Active' : 'Preview'}
              </span>
            ) : (
              <span className="rounded-full border border-civic-ivory/20 px-2 py-0.5 text-[10px] font-bold uppercase text-civic-ivory/55">
                0
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 lg:col-span-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-btp-cyan/12 bg-civic-navy/55 px-3 py-2.5 text-center backdrop-blur-xl">
              <p className="text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">{m.label}</p>
              {m.sub && <p className="text-[7px] text-civic-ivory/30">{m.sub}</p>}
              <p className="mt-1 text-lg font-bold tabular-nums text-civic-white">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {!backendBoost && (
        <div className="flex flex-col gap-2 rounded-2xl border border-status-amber/20 bg-status-amber/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-civic-ivory/65">
            Backend reports <strong className="text-status-amber">no structural boost</strong> for this cluster yet.
            Preview the closed-loop visual without changing backend data.
          </p>
          <CommandButton variant="amber" onClick={() => setPreview(true)} disabled={preview}>
            <Sparkles className="h-4 w-4" />
            {preview ? 'Preview active' : 'Demo structural boost preview'}
          </CommandButton>
        </div>
      )}
    </div>
  )
}
