import { ChevronDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { filterSelectClassName } from '@/lib/fieldStyles'
import { useTheme } from '@/theme/ThemeProvider'

export type ClassFilter = 'ALL' | 'STRUCTURAL' | 'RESPONSIVE' | 'SEASONAL'

interface MapControlsProps {
  stations: string[]
  station: string
  onStation: (s: string) => void
  classification: ClassFilter
  onClassification: (c: ClassFilter) => void
  showHotspots: boolean
  onToggleHotspots: () => void
  showRoute: boolean
  onToggleRoute: () => void
  escalationOnly: boolean
  onToggleEscalation: () => void
  onReset: () => void
}

const CLASS_OPTIONS: ClassFilter[] = ['ALL', 'STRUCTURAL', 'RESPONSIVE', 'SEASONAL']

export function MapControls({
  stations,
  station,
  onStation,
  classification,
  onClassification,
  showHotspots,
  onToggleHotspots,
  showRoute,
  onToggleRoute,
  escalationOnly,
  onToggleEscalation,
  onReset,
}: MapControlsProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  const chipLabel = isDark ? 'text-civic-ivory/40' : 'text-shell-muted'
  const chipIcon = isDark ? 'text-civic-ivory/45' : 'text-shell-muted'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectChip value={station} onChange={onStation} label="Station" chipLabel={chipLabel} chipIcon={chipIcon}>
        <option value="ALL">All stations</option>
        {stations.map((s) => (
          <option key={s} value={s}>
            {formatStation(s)}
          </option>
        ))}
      </SelectChip>

      <SelectChip
        value={classification}
        onChange={(v) => onClassification(v as ClassFilter)}
        label="Class"
        chipLabel={chipLabel}
        chipIcon={chipIcon}
      >
        {CLASS_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c === 'ALL' ? 'All classes' : c.charAt(0) + c.slice(1).toLowerCase()}
          </option>
        ))}
      </SelectChip>

      <Toggle active={showHotspots} onClick={onToggleHotspots} label="Hotspots" />
      <Toggle active={showRoute} onClick={onToggleRoute} label="Route" />
      <Toggle active={escalationOnly} onClick={onToggleEscalation} label="Escalation only" tone="structural" />

      <button
        type="button"
        onClick={onReset}
        className={cn(
          'focus-ring-command ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
          isDark
            ? 'border-btp-cyan/15 bg-civic-navy/60 text-civic-ivory/70 hover:border-btp-cyan/35 hover:text-civic-white'
            : 'border-[var(--glass-border)] bg-[var(--color-bg-muted)] text-shell-muted hover:border-[var(--color-accent)] hover:text-shell',
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
    </div>
  )
}

function SelectChip({
  value,
  onChange,
  label,
  chipLabel,
  chipIcon,
  children,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  chipLabel: string
  chipIcon: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <span className={cn('pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide', chipLabel)}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={filterSelectClassName}
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown className={cn('pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2', chipIcon)} />
    </div>
  )
}

function Toggle({
  active,
  onClick,
  label,
  tone = 'cyan',
}: {
  active: boolean
  onClick: () => void
  label: string
  tone?: 'cyan' | 'structural'
}) {
  const activeCls =
    tone === 'structural'
      ? 'border-status-structural/40 bg-status-structural/15 text-status-structural'
      : 'border-btp-cyan/40 bg-btp-cyan/15 text-btp-cyan'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring-command inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
        active ? activeCls : 'border-btp-cyan/12 bg-civic-navy/60 text-civic-ivory/55 hover:text-civic-white',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? (tone === 'structural' ? 'bg-status-structural' : 'bg-btp-cyan') : 'bg-civic-ivory/30',
        )}
      />
      {label}
    </button>
  )
}
