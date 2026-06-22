import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function formatNumber(value: number, decimals = 1): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`
}

export function formatRoi(value: number): string {
  return formatNumber(value, 1)
}

export function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy, h:mm a')
  } catch {
    return iso
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export function formatStation(station: string): string {
  if (!station || station === '—') return station
  return station.replace(/_/g, ' ') + ' Traffic Police Station'
}

/** Station name without the "Traffic Police Station" suffix — for compact chips and dropdowns. */
export function formatStationShort(station: string): string {
  return station.replace(/_/g, ' ')
}
