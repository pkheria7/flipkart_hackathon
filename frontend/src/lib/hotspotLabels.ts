/**
 * Human-readable display label helpers for hotspot clusters.
 *
 * Priority order for the primary display name:
 *  1. Cleaned junction name (strips BTPxxx prefix)
 *  2. Extracted locality from raw address (2-3 segments before "Bengaluru")
 *  3. Formatted station name
 *  4. Cluster ID as last resort
 *
 * Cluster IDs are NEVER removed from data — they appear as secondary metadata.
 */
import type { CommandHotspot } from './hotspots'
import { formatStation } from './formatters'

// ── Internal label extractors ─────────────────────────────────────────────────

/**
 * Strip "BTP040 - " prefix from junction names.
 * Returns null for "No Junction" or empty values.
 */
function cleanJunctionName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^no junction$/i.test(trimmed) || trimmed === '') return null
  // "BTP040 - Elite Junction" → "Elite Junction"
  const prefixMatch = trimmed.match(/^BTP\d+\s*[-–]\s*(.+)$/i)
  return (prefixMatch ? prefixMatch[1] : trimmed).trim()
}

/**
 * Extract the most meaningful 1-2 locality segments from a full address string.
 *
 * Example:
 *   "Mysore Road, Sri Krishna Rajendra Market, Chickpete, Bengaluru, Karnataka. Pin-560002 (India)"
 *   → "Sri Krishna Rajendra Market, Chickpete"
 */
function extractLocality(address: string | null | undefined): string | null {
  if (!address) return null

  // Strip trailing country/state/pin noise
  let s = address
    .replace(/\.\s*Pin[-\s]\d+\s*\(India\)/gi, '')
    .replace(/,?\s*\(India\)/gi, '')
    .replace(/,?\s*Karnataka\.?\s*$/i, '')
    .replace(/,?\s*Bengaluru\.?\s*$/i, '')
    .trim()

  const parts = s.split(',').map((p) => p.trim()).filter((p) => p.length > 2)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]

  // Skip the first segment if it looks like a road descriptor
  // (e.g. "80 Feet Ring Road", "5th Main Road", "Mysore Road")
  const roadPattern = /^\d+\s+Feet|main road$|ring road$|cross road$|^[A-Z][\w\s]+ road$/i
  const start = roadPattern.test(parts[0]) ? 1 : 0

  // Take up to 2 meaningful segments
  return parts.slice(start, start + 2).join(', ')
}

/**
 * Title-case a string (basic implementation for station/area names).
 */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Primary human-readable display name for a hotspot.
 *
 * Examples:
 *  - "KR Market Junction"          (from junction_name_mode)
 *  - "Sri Krishna Rajendra Market" (from location_mode locality)
 *  - "City Market hotspot"         (from station name)
 */
export function getHotspotDisplayName(h: CommandHotspot): string {
  // 1. Junction name (stripped of BTP prefix)
  const junction = cleanJunctionName(h.junction_name_mode)
  if (junction) return junction

  // 2. Locality extracted from full address
  const locality = extractLocality(h.location_mode)
  if (locality) return locality

  // 3. Station name as fallback
  const stationLabel = formatStation(h.station)
  if (stationLabel && stationLabel !== '—') {
    return `${stationLabel} hotspot`
  }

  // 4. Last resort
  return `Cluster ${h.cluster_id}`
}

/**
 * Secondary/subtitle line — cluster metadata shown below the display name.
 *
 * Example: "Cluster C_0_0 · Structural · Peak 01:00–03:00"
 */
export function getHotspotSubtitle(h: CommandHotspot): string {
  const parts: string[] = [`Cluster ${h.cluster_id}`]
  if (h.classification !== 'UNKNOWN') {
    parts.push(toTitleCase(h.classification))
  }
  if (h.peak_window) {
    parts.push(`Peak ${h.peak_window}`)
  }
  return parts.join(' · ')
}

/**
 * Short compact label for maps, chips, and tooltips.
 *
 * Examples:
 *  - "KR Market Junction · C_0_0"
 *  - "Malleshwaram hotspot · C_22"
 */
export function getHotspotLocationLabel(h: CommandHotspot): string {
  return `${getHotspotDisplayName(h)} · ${h.cluster_id}`
}

/**
 * Purely the cluster ID + station for technical/audit displays.
 *
 * Example: "C_0_0 · CITY MARKET"
 */
export function getHotspotMetadataLabel(h: CommandHotspot): string {
  const station = formatStation(h.station)
  return station && station !== '—' ? `${h.cluster_id} · ${station}` : h.cluster_id
}

/**
 * One-line page title for the Hotspot Detail page.
 *
 * Example: "KR Market Junction"
 */
export function getHotspotPageTitle(h: CommandHotspot): string {
  return getHotspotDisplayName(h)
}

/**
 * Subtitle for the Hotspot Detail page header.
 *
 * Example: "Cluster C_0_0 · CITY MARKET"
 */
export function getHotspotPageSubtitle(h: CommandHotspot): string {
  const station = formatStation(h.station)
  const parts = [`Cluster ${h.cluster_id}`]
  if (station && station !== '—') parts.push(station)
  return parts.join(' · ')
}
