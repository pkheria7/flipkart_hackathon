import { motion } from 'framer-motion'
import { prefersReducedMotion } from '@/lib/motion'
import type { TrendPoint } from '@/data/impactEvidenceData'

interface SeriesDef {
  key: 'pressureIdx' | 'recurrenceIdx' | 'structuralIdx'
  label: string
  color: string
}

const series: SeriesDef[] = [
  { key: 'pressureIdx', label: 'Violation pressure', color: 'var(--btp-cyan)' },
  { key: 'recurrenceIdx', label: 'Recurrence', color: 'var(--status-seasonal)' },
  { key: 'structuralIdx', label: 'Structural', color: 'var(--status-structural)' },
]

const W = 720
const H = 260
const PAD = { top: 18, right: 18, bottom: 30, left: 40 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

export function ImpactTrendChart({ trend }: { trend: TrendPoint[] }) {
  const reduced = prefersReducedMotion()

  const allValues = trend.flatMap((p) => [p.pressureIdx, p.recurrenceIdx, p.structuralIdx])
  const rawMin = Math.min(...allValues, 100)
  const rawMax = Math.max(...allValues, 100)
  const yMin = Math.floor((rawMin - 5) / 5) * 5
  const yMax = Math.ceil((rawMax + 5) / 5) * 5

  const xFor = (day: number) => PAD.left + ((day - 1) / 13) * plotW
  const yFor = (value: number) =>
    PAD.top + (1 - (value - yMin) / (yMax - yMin || 1)) * plotH

  const buildPath = (key: SeriesDef['key']) =>
    trend
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.day).toFixed(1)} ${yFor(p[key]).toFixed(1)}`)
      .join(' ')

  const gridLines = [yMin, (yMin + yMax) / 2, yMax]
  const weekDivideX = xFor(7.5)

  return (
    <div className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-5 shadow-command backdrop-blur-xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-shell">14-day pressure trend</p>
          <p className="text-xs text-shell-muted">Indexed to Week 1 Day 1 = 100 · lower is better</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-medium text-shell-muted">
              <span className="h-1.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Week 1 vs Week 2 trend chart">
        {/* horizontal grid + y labels */}
        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="var(--color-accent)"
              strokeOpacity={0.1}
              strokeDasharray="3 4"
            />
            <text x={PAD.left - 8} y={yFor(g) + 3} textAnchor="end" fontSize="10" fill="var(--page-fg-muted)">
              {Math.round(g)}
            </text>
          </g>
        ))}

        {/* baseline 100 reference */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yFor(100)}
          y2={yFor(100)}
          stroke="var(--page-fg-muted)"
          strokeOpacity={0.35}
          strokeWidth={1}
        />

        {/* week divider */}
        <line
          x1={weekDivideX}
          x2={weekDivideX}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="var(--color-accent)"
          strokeOpacity={0.25}
          strokeDasharray="2 4"
        />
        <text x={xFor(4)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--page-fg-muted)">
          Week 1 — Baseline
        </text>
        <text x={xFor(11)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--page-fg-muted)">
          Week 2 — Enforcement
        </text>

        {/* series lines */}
        {series.map((s, si) => (
          <motion.path
            key={s.key}
            d={buildPath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeInOut', delay: si * 0.15 }}
          />
        ))}

        {/* end-point dots for the pressure series */}
        {trend.length > 0 && (
          <circle
            cx={xFor(trend[trend.length - 1].day)}
            cy={yFor(trend[trend.length - 1].pressureIdx)}
            r={3.5}
            fill="var(--btp-cyan)"
          />
        )}
      </svg>
    </div>
  )
}
