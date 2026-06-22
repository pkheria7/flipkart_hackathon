import type { CommandHotspot } from '@/lib/hotspots'

export type MarkerTier = 'hero' | 'priority' | 'context' | 'selected'

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MapMarkerPartition {
  hero: CommandHotspot[]
  priority: CommandHotspot[]
  context: CommandHotspot[]
  /** Extra marker when selection is not in hero/priority buckets. */
  selectedOverlay: CommandHotspot | null
}

export interface PartitionMapMarkersOptions {
  isAllStations: boolean
  selectedId: string | null
  zoom: number
  bounds?: MapBounds | null
}

const STATION_DETAIL_CAP = 200

/** ROI-first sort; structural + escalation clusters surface earlier. */
export function sortHotspotsByMapPriority(hotspots: CommandHotspot[]): CommandHotspot[] {
  return [...hotspots].sort((a, b) => {
    if (a.escalation_boost !== b.escalation_boost) return a.escalation_boost ? -1 : 1
    if (a.classification === 'STRUCTURAL' && b.classification !== 'STRUCTURAL') return -1
    if (b.classification === 'STRUCTURAL' && a.classification !== 'STRUCTURAL') return 1
    return b.roi - a.roi
  })
}

function inBounds(h: CommandHotspot, bounds: MapBounds): boolean {
  return h.lng >= bounds.west && h.lng <= bounds.east && h.lat >= bounds.south && h.lat <= bounds.north
}

function getCityOverviewCaps(zoom: number): { hero: number; visible: number } {
  if (zoom >= 13) return { hero: 25, visible: 120 }
  if (zoom >= 11.5) return { hero: 22, visible: 80 }
  return { hero: 20, visible: 50 }
}

function pickSelectedOverlay(
  sorted: CommandHotspot[],
  visibleIds: Set<string>,
  selectedId: string | null,
): CommandHotspot | null {
  if (!selectedId || visibleIds.has(selectedId)) return null
  return sorted.find((h) => h.cluster_id === selectedId) ?? null
}

/**
 * Splits filtered hotspots into hero / priority / context layers for map rendering.
 * Data is never dropped from KPIs or lists — only visualization tiers change.
 */
export function partitionMapMarkers(
  hotspots: CommandHotspot[],
  options: PartitionMapMarkersOptions,
): MapMarkerPartition {
  const sorted = sortHotspotsByMapPriority(hotspots)
  const { isAllStations, selectedId, zoom, bounds } = options

  if (!isAllStations) {
    const cap = sorted.length <= STATION_DETAIL_CAP ? sorted.length : STATION_DETAIL_CAP
    const visible = sorted.slice(0, cap)
    const hero = visible.slice(0, Math.min(20, visible.length))
    const priority = visible.slice(hero.length)
    const context = sorted.slice(cap)
    const visibleIds = new Set([...hero, ...priority].map((h) => h.cluster_id))
    const selectedOverlay = pickSelectedOverlay(sorted, visibleIds, selectedId)
    const contextFiltered = selectedOverlay
      ? context.filter((h) => h.cluster_id !== selectedOverlay.cluster_id)
      : context
    return { hero, priority, context: contextFiltered, selectedOverlay }
  }

  const { hero: heroCount, visible: visibleCap } = getCityOverviewCaps(zoom)
  const hero = sorted.slice(0, heroCount)
  const priorityBase = sorted.slice(heroCount, visibleCap)
  const visibleIds = new Set<string>([...hero, ...priorityBase].map((h) => h.cluster_id))

  // High zoom: add in-view clusters so local detail appears without showing all 1084 bubbles.
  const priorityExtra: CommandHotspot[] = []
  if (zoom >= 12.5 && bounds) {
    for (const h of sorted) {
      if (visibleIds.has(h.cluster_id)) continue
      if (!inBounds(h, bounds)) continue
      priorityExtra.push(h)
      visibleIds.add(h.cluster_id)
      if (priorityExtra.length >= 60) break
    }
  }

  const priority = [...priorityBase, ...priorityExtra]
  let context = sorted.filter((h) => !visibleIds.has(h.cluster_id))
  const selectedOverlay = pickSelectedOverlay(sorted, visibleIds, selectedId)
  if (selectedOverlay) {
    context = context.filter((h) => h.cluster_id !== selectedOverlay.cluster_id)
  }

  return { hero, priority, context, selectedOverlay }
}

export function flattenPartitionForBounds(partition: MapMarkerPartition): CommandHotspot[] {
  const out = [...partition.hero, ...partition.priority, ...partition.context]
  if (partition.selectedOverlay) out.push(partition.selectedOverlay)
  return out
}

export function getMapViewLabel(isAllStations: boolean): string {
  return isAllStations
    ? 'City overview · showing top ROI clusters'
    : 'Station view · showing station clusters'
}
