import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { formatNumber, formatStation } from '@/lib/formatters'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { EvidenceCluster, EvidenceStatus } from '@/data/impactEvidenceData'

const evidenceStyle: Record<EvidenceStatus, string> = {
  'Evidence Ready': 'bg-status-cleared/10 text-status-cleared border-status-cleared/25',
  'Needs Field Check': 'bg-status-amber/10 text-status-amber border-status-amber/25',
  'Monitor One More Week': 'bg-btp-cyan/10 text-btp-cyan border-btp-cyan/25',
  'Escalate to BBMP/BTP': 'bg-status-structural/10 text-status-structural border-status-structural/25',
}

function ChangePill({ changePct }: { changePct: number }) {
  const improved = changePct <= 0
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
        improved ? 'bg-status-cleared/10 text-status-cleared' : 'bg-status-amber/10 text-status-amber',
      )}
    >
      {improved ? '' : '+'}
      {changePct.toFixed(1)}%
    </span>
  )
}

function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        evidenceStyle[status],
      )}
    >
      {status}
    </span>
  )
}

export function EvidenceClusterTable({ clusters }: { clusters: EvidenceCluster[] }) {
  return (
    <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 shadow-command backdrop-blur-xl">
      <div className="border-b border-btp-cyan/10 px-5 py-3">
        <p className="text-sm font-bold text-shell">Top evidence clusters</p>
        <p className="text-xs text-shell-muted">
          Week 1 → Week 2 pressure, evidence status, and recommended next action
        </p>
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-btp-cyan/10 text-[10px] uppercase tracking-wider text-shell-muted">
              <th className="px-5 py-2.5 font-semibold">Cluster</th>
              <th className="px-3 py-2.5 font-semibold">Station</th>
              <th className="px-3 py-2.5 text-right font-semibold">W1</th>
              <th className="px-3 py-2.5 text-right font-semibold">W2</th>
              <th className="px-3 py-2.5 text-right font-semibold">Change</th>
              <th className="px-3 py-2.5 font-semibold">Class</th>
              <th className="px-3 py-2.5 font-semibold">Evidence</th>
              <th className="px-5 py-2.5 font-semibold">Next action</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => (
              <tr
                key={c.clusterId}
                className="border-b border-btp-cyan/8 transition-colors last:border-0 hover:bg-civic-white/5"
              >
                <td className="px-5 py-3 font-mono text-xs font-semibold text-btp-cyan">{c.clusterId}</td>
                <td className="px-3 py-3 text-shell">{formatStation(c.station)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-shell-muted">
                  {formatNumber(c.week1Pressure, 0)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-shell">
                  {formatNumber(c.week2Pressure, 0)}
                </td>
                <td className="px-3 py-3 text-right">
                  <ChangePill changePct={c.changePct} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={c.classification} />
                </td>
                <td className="px-3 py-3">
                  <EvidenceBadge status={c.evidenceStatus} />
                </td>
                <td className="px-5 py-3 text-xs font-medium text-shell-muted">{c.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-3 p-4 lg:hidden"
      >
        {clusters.map((c) => (
          <motion.div
            key={c.clusterId}
            variants={fadeUp}
            className="rounded-xl border border-btp-cyan/12 bg-civic-dusk/50 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-btp-cyan">{c.clusterId}</span>
              <StatusBadge status={c.classification} />
            </div>
            <p className="mt-1 text-xs text-shell-muted">{formatStation(c.station)}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="tabular-nums text-shell-muted">{formatNumber(c.week1Pressure, 0)}</span>
              <span className="text-shell-muted">→</span>
              <span className="tabular-nums font-bold text-shell">{formatNumber(c.week2Pressure, 0)}</span>
              <ChangePill changePct={c.changePct} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <EvidenceBadge status={c.evidenceStatus} />
              <span className="text-xs font-medium text-shell-muted">{c.nextAction}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
