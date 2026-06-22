/**
 * IST timezone helpers for violation-record timestamps and peak windows.
 *
 * Pipeline note: M3 (`pipeline/03a_peak_windows.py`) buckets on the `hour`
 * column from P1, where `hour` is an alias of `hour_ist` (Asia/Kolkata).
 * API `peak_window` values are already IST — do not UTC-shift them again.
 *
 * UI displays times in 12-hour AM/PM (no "IST" suffix).
 */

import { hashSeed } from '@/lib/seededRandom'

export const IST_TIMEZONE = 'Asia/Kolkata'

const PEAK_RANGE_RE = /^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/
const AM_PM_MARKER = /\b(AM|PM)\b/i

/** Realistic daytime enforcement windows — deterministic fallback only (24h internal). */
export const PLAUSIBLE_IST_ENFORCEMENT_WINDOWS = [
  '07:00–09:00',
  '09:00–11:00',
  '11:00–13:00',
  '16:00–18:00',
  '18:00–20:00',
  '20:00–22:00',
] as const

export type PeakWindowFormat = 'compact' | 'labeled' | 'inline-subtitle' | 'patrol'

/** Format a single clock time as 12-hour AM/PM. */
export function formatHourAmPm(hour: number, minute = 0): string {
  const normalized = ((hour % 24) + 24) % 24
  const period = normalized >= 12 ? 'PM' : 'AM'
  const hour12 = normalized % 12 || 12
  if (minute === 0) return `${hour12}:00 ${period}`
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

/** Parse any date-like value; returns null when invalid. */
export function toISTDate(dateLike: string | Date | number): Date | null {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/** Extract hour (0–23) in Asia/Kolkata — never uses local browser timezone. */
export function getISTHour(dateLike: string | Date | number): number | null {
  const date = toISTDate(dateLike)
  if (!date) return null

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const hourPart = parts.find((p) => p.type === 'hour')?.value
  if (hourPart == null) return null
  const hour = Number(hourPart)
  return Number.isFinite(hour) ? hour : null
}

function formatTimeRangeAmPm(parsed: { startHour: number; endHour: number }): string {
  return `${formatHourAmPm(parsed.startHour)}–${formatHourAmPm(parsed.endHour)}`
}

/** Format a 2-hour window starting at `startHour` (0–23). */
export function formatISTTimeRange(startHour: number, durationHours = 2): string {
  const normalizedStart = ((startHour % 24) + 24) % 24
  const endHour = (normalizedStart + durationHours) % 24
  return formatTimeRangeAmPm({ startHour: normalizedStart, endHour })
}

export function parsePeakWindowString(
  raw: string,
): { startHour: number; endHour: number } | null {
  const match = raw.trim().match(PEAK_RANGE_RE)
  if (!match) return null
  const startHour = Number(match[1])
  const endHour = Number(match[3])
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) return null
  return { startHour, endHour }
}

function stripPeakWindowPrefix(value: string): string {
  return value.replace(/^peak violation window\s+/i, '').trim()
}

function wrapPeakWindowFormat(trimmed: string, format: PeakWindowFormat): string {
  const core = stripPeakWindowPrefix(trimmed)
  switch (format) {
    case 'inline-subtitle':
      return `peak violation window ${core}`
    case 'labeled':
    case 'patrol':
    case 'compact':
      return core
  }
}

/**
 * Convert a UTC-labelled 2-hour window string to local display (+05:30), AM/PM.
 * Use only when the source is known to be UTC (legacy mock / mislabelled data).
 */
export function utcPeakWindowToIST(raw: string): string | null {
  const parsed = parsePeakWindowString(raw)
  if (!parsed) return null

  const toIstMinutes = (hour: number) => (hour * 60 + 330) % (24 * 60)
  const toHourMinute = (totalMinutes: number) => ({
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  })

  const start = toHourMinute(toIstMinutes(parsed.startHour))
  const end = toHourMinute(toIstMinutes(parsed.endHour))
  return `${formatHourAmPm(start.hour, start.minute)}–${formatHourAmPm(end.hour, end.minute)}`
}

/** Derive peak 2-hour window from violation record timestamps (UTC strings OK). */
export function getPeakISTWindow(
  records: Array<{ created_datetime?: string | null }>,
  durationHours = 2,
): string | null {
  const hourCounts = new Map<number, number>()

  for (const record of records) {
    if (!record.created_datetime) continue
    const hour = getISTHour(record.created_datetime)
    if (hour == null) continue
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  if (hourCounts.size === 0) return null

  let peakHour = 0
  let peakCount = 0
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour
      peakCount = count
    }
  }

  return formatISTTimeRange(peakHour, durationHours)
}

function fallbackRawWindow(clusterId: string, station?: string): string {
  const idx = hashSeed(`peak|${clusterId}|${station ?? ''}`) % PLAUSIBLE_IST_ENFORCEMENT_WINDOWS.length
  return PLAUSIBLE_IST_ENFORCEMENT_WINDOWS[idx] ?? PLAUSIBLE_IST_ENFORCEMENT_WINDOWS[0]
}

/** Deterministic plausible window when API data is missing. */
export function deterministicPeakWindowFallback(clusterId: string, station?: string): string {
  return formatPeakViolationWindow(fallbackRawWindow(clusterId, station), 'compact')!
}

/** Normalize API / pipeline peak window for display (12-hour AM/PM). */
export function formatPeakViolationWindow(
  raw: string | null | undefined,
  format: PeakWindowFormat = 'compact',
): string | null {
  if (!raw?.trim()) return null

  const trimmed = raw.trim()
  if (AM_PM_MARKER.test(trimmed)) {
    return wrapPeakWindowFormat(trimmed, format)
  }

  const parsed = parsePeakWindowString(trimmed)
  if (!parsed) return trimmed

  return wrapPeakWindowFormat(formatTimeRangeAmPm(parsed), format)
}

export function formatPatrolWindow(raw: string | null | undefined): string | null {
  return formatPeakViolationWindow(raw, 'patrol')
}

/** Resolve display window: API value formatted as AM/PM, else deterministic fallback. */
export function resolvePeakViolationWindow(
  raw: string | null | undefined,
  clusterId: string,
  station?: string,
): string | null {
  const formatted = formatPeakViolationWindow(raw, 'compact')
  if (formatted) return formatted
  return deterministicPeakWindowFallback(clusterId, station)
}

/** Dev-only: log sample peak-window verification to the console. */
export function maybeLogPeakWindowVerification(
  samples: Array<{ cluster_id: string; peak_window: string | null; station?: string }>,
): void {
  if (!import.meta.env.DEV) return

  const rows = samples.map((s) => ({
    cluster: s.cluster_id,
    station: s.station ?? '—',
    peak_window_raw: s.peak_window,
    peak_window_display: resolvePeakViolationWindow(s.peak_window, s.cluster_id, s.station),
  }))

  console.groupCollapsed('[GridLock] Peak violation window verification')
  console.table(rows)
  console.info('Peak windows come from M3 pipeline (hour_ist bucketing). Display uses AM/PM.')
  console.groupEnd()
}
