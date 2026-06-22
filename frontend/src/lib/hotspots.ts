import type { ApiHotspot } from '@/types/api'
import type { Classification } from '@/types/common'
import { resolvePeakViolationWindow } from '@/lib/timezone'

/** Canonical classification colors (Civic Aurora — Dusk Edition). */
export const CLASSIFICATION_HEX: Record<Classification, string> = {
  STRUCTURAL: '#D62828', // structural red
  RESPONSIVE: '#22D3EE', // electric cyan
  SEASONAL: '#7C3AED', // seasonal violet
}

/** Neutral signal-blue for unknown / unclassified clusters. */
export const NEUTRAL_HEX = '#146C94'

export function classificationColor(c?: string | null): string {
  const key = (c ?? '').toUpperCase() as Classification
  return CLASSIFICATION_HEX[key] ?? NEUTRAL_HEX
}

export function normalizeClassification(c?: string | null): Classification | 'UNKNOWN' {
  const key = (c ?? '').toUpperCase()
  if (key === 'STRUCTURAL' || key === 'RESPONSIVE' || key === 'SEASONAL') return key
  return 'UNKNOWN'
}

/** A map-ready hotspot with guaranteed numeric coordinates and roi. */
export interface CommandHotspot {
  cluster_id: string
  lat: number
  lng: number
  station: string
  classification: Classification | 'UNKNOWN'
  roi: number
  violations: number
  lcle: number | null
  bci: number | null
  persistence: number | null
  recurrence: number | null
  osm_coverage: number | null
  vehicle_mix: Record<string, number> | null
  peak_window: string | null
  road_class: string | null
  road_width_m: number | null
  recommended_action: string | null
  escalation_boost: boolean
  /** Raw dominant address string from cluster_summary (used for label derivation). */
  location_mode: string | null
  /** Raw dominant junction name from cluster_summary (used for label derivation). */
  junction_name_mode: string | null
  raw: ApiHotspot
}

function num(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function parseVehicleMix(v: unknown): Record<string, number> | null {
  if (!v) return null
  if (typeof v === 'object') return v as Record<string, number>
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, number>) : null
    } catch {
      return null
    }
  }
  return null
}

/** Convert a loose API hotspot into a clean map-ready record. Returns null if no valid coords. */
export function toCommandHotspot(h: ApiHotspot): CommandHotspot | null {
  const lat = num(h.centroid_lat)
  const lng = num(h.centroid_lng)
  if (lat === null || lng === null) return null
  return {
    cluster_id: h.cluster_id,
    lat,
    lng,
    station: h.assigned_station ?? '—',
    classification: normalizeClassification(h.classification),
    roi: num(h.roi_score) ?? 0,
    violations: num(h.violation_count) ?? 0,
    lcle: num(h.lcle_pct),
    bci: num(h.bci),
    persistence: num(h.persistence),
    recurrence: num(h.recurrence),
    osm_coverage: num(h.osm_coverage),
    vehicle_mix: parseVehicleMix(h.vehicle_mix),
    peak_window: resolvePeakViolationWindow(h.peak_window, h.cluster_id, h.assigned_station ?? undefined),
    road_class: h.road_class ?? null,
    road_width_m: num(h.road_width_m),
    recommended_action: h.recommended_action ?? null,
    escalation_boost: (num(h.feedback_structural_boost) ?? 0) > 0,
    location_mode: h.location_mode ?? null,
    junction_name_mode: h.junction_name_mode ?? null,
    raw: h,
  }
}

export function toCommandHotspots(list: ApiHotspot[] | undefined): CommandHotspot[] {
  if (!list) return []
  const out: CommandHotspot[] = []
  for (const h of list) {
    const c = toCommandHotspot(h)
    if (c) out.push(c)
  }
  return out
}

/** A simple route line for the map overlay. */
export interface RouteLine {
  route_id: string
  station: string
  routing_mode: string
  coordinates: Array<[number, number]> // [lng, lat]
  stops: Array<{ cluster_id: string; lng: number; lat: number; order: number }>
}
