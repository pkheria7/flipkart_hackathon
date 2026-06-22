import { ChevronDown } from 'lucide-react'
import { formatStation } from '@/lib/formatters'

interface StationOption {
  station: string
  routeId: string
  stops: number
}

interface StationRouteSelectorProps {
  options: StationOption[]
  value: string
  onChange: (station: string) => void
}

export function StationRouteSelector({ options, value, onChange }: StationRouteSelectorProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wide text-civic-ivory/40">
        Station
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select station route"
        className="focus-ring-command w-full cursor-pointer appearance-none rounded-xl border border-btp-cyan/15 bg-civic-navy/60 py-2.5 pl-16 pr-9 text-sm font-semibold text-civic-white backdrop-blur-xl"
      >
        {options.length === 0 && <option value="">No routes available</option>}
        {options.map((o) => (
          <option key={o.station} value={o.station}>
            {formatStation(o.station)} · {o.stops} stops
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-civic-ivory/45" />
    </div>
  )
}
