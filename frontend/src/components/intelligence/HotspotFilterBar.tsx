import { ChevronDown, Search, TrendingUp, Hash } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import { filterInputClassName, filterSelectClassName } from '@/lib/fieldStyles'
import { useTheme } from '@/theme/ThemeProvider'

export type SortMode = 'roi_score' | 'violation_count'
export type ClassFilter = 'ALL' | 'STRUCTURAL' | 'RESPONSIVE' | 'SEASONAL'

interface HotspotFilterBarProps {
  stations: string[]
  roadClasses: string[]
  station: string
  onStation: (s: string) => void
  classification: ClassFilter
  onClassification: (c: ClassFilter) => void
  roadClass: string
  onRoadClass: (r: string) => void
  sortMode: SortMode
  onSortMode: (s: SortMode) => void
  search: string
  onSearch: (q: string) => void
}

const CLASS_OPTIONS: ClassFilter[] = ['ALL', 'STRUCTURAL', 'RESPONSIVE', 'SEASONAL']

export function HotspotFilterBar({
  stations,
  roadClasses,
  station,
  onStation,
  classification,
  onClassification,
  roadClass,
  onRoadClass,
  sortMode,
  onSortMode,
  search,
  onSearch,
}: HotspotFilterBarProps) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  const chipLabel = isDark ? 'text-civic-ivory/40' : 'text-shell-muted'
  const chipIcon = isDark ? 'text-civic-ivory/45' : 'text-shell-muted'

  return (
    <div className="filter-bar-shell flex flex-wrap items-center gap-2 rounded-2xl border p-2.5 backdrop-blur-xl">
      <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
        <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', chipIcon)} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search cluster, station, road…"
          className={filterInputClassName}
        />
      </div>

      <SelectChip value={station} onChange={onStation} label="Station" chipLabel={chipLabel} chipIcon={chipIcon}>
        <option value="ALL">All stations</option>
        {stations.map((s) => (
          <option key={s} value={s}>
            {formatStation(s)}
          </option>
        ))}
      </SelectChip>

      <SelectChip value={classification} onChange={(v) => onClassification(v as ClassFilter)} label="Class" chipLabel={chipLabel} chipIcon={chipIcon}>
        {CLASS_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c === 'ALL' ? 'All classes' : c.charAt(0) + c.slice(1).toLowerCase()}
          </option>
        ))}
      </SelectChip>

      {roadClasses.length > 0 && (
        <SelectChip value={roadClass} onChange={onRoadClass} label="Road" chipLabel={chipLabel} chipIcon={chipIcon}>
          <option value="ALL">All roads</option>
          {roadClasses.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectChip>
      )}

      <div className={cn(
        'ml-auto inline-flex items-center gap-1 rounded-lg border p-0.5',
        isDark ? 'border-btp-cyan/15 bg-civic-navy/60' : 'border-[var(--glass-border)] bg-[var(--color-bg-muted)]',
      )}>
        <SortToggle
          active={sortMode === 'roi_score'}
          onClick={() => onSortMode('roi_score')}
          icon={TrendingUp}
          label="Rank by ROI"
        />
        <SortToggle
          active={sortMode === 'violation_count'}
          onClick={() => onSortMode('violation_count')}
          icon={Hash}
          label="By Count"
        />
      </div>
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

function SortToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof TrendingUp
  label: string
}) {
  const { themeDefinition } = useTheme()
  const isDark = themeDefinition.isDark
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring-command inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active
          ? 'bg-btp-blue/80 text-civic-white shadow-glow-cyan'
          : isDark
            ? 'text-civic-ivory/55 hover:text-civic-white'
            : 'text-shell-muted hover:text-shell',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
