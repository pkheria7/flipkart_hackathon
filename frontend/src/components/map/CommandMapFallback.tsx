import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { classificationColor, type CommandHotspot, type RouteLine } from '@/lib/hotspots'
import {
  flattenPartitionForBounds,
  getMapViewLabel,
  partitionMapMarkers,
} from '@/lib/mapMarkerStrategy'
import { MapLegend } from './MapLegend'

interface CommandMapFallbackProps {
  hotspots: CommandHotspot[]
  route?: RouteLine | null
  selectedId?: string | null
  showHotspots?: boolean
  showRoute?: boolean
  onSelect?: (id: string) => void
  className?: string
  smartRender?: boolean
  isAllStations?: boolean
}

interface Bounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

const PAD = 0.06

export function CommandMapFallback({
  hotspots,
  route,
  selectedId,
  showHotspots = true,
  showRoute = true,
  onSelect,
  className,
  smartRender = false,
  isAllStations = true,
}: CommandMapFallbackProps) {
  const [hover, setHover] = useState<string | null>(null)

  const renderHotspots = useMemo(() => {
    if (!showHotspots) return []
    if (!smartRender) return hotspots
    const partition = partitionMapMarkers(hotspots, {
      isAllStations,
      selectedId: selectedId ?? null,
      zoom: 10.6,
      bounds: null,
    })
    return flattenPartitionForBounds(partition)
  }, [hotspots, showHotspots, smartRender, isAllStations, selectedId])

  const markerMeta = useMemo(() => {
    if (!smartRender) {
      return new Map(renderHotspots.map((h) => [h.cluster_id, { tier: 'hero' as const }]))
    }
    const partition = partitionMapMarkers(hotspots, {
      isAllStations,
      selectedId: selectedId ?? null,
      zoom: 10.6,
      bounds: null,
    })
    const meta = new Map<string, { tier: 'hero' | 'priority' | 'context' | 'selected' }>()
    partition.hero.forEach((h) => meta.set(h.cluster_id, { tier: 'hero' }))
    partition.priority.forEach((h) => meta.set(h.cluster_id, { tier: 'priority' }))
    partition.context.forEach((h) => meta.set(h.cluster_id, { tier: 'context' }))
    if (partition.selectedOverlay) meta.set(partition.selectedOverlay.cluster_id, { tier: 'selected' })
    return meta
  }, [hotspots, smartRender, isAllStations, selectedId, renderHotspots])

  const bounds = useMemo<Bounds>(() => {
    const pts: Array<[number, number]> = renderHotspots.map((h) => [h.lng, h.lat])
    if (route) route.coordinates.forEach((c) => pts.push(c))
    if (pts.length === 0) {
      return { minLng: 77.45, maxLng: 77.75, minLat: 12.85, maxLat: 13.08 }
    }
    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }
    const dLng = (maxLng - minLng) || 0.02
    const dLat = (maxLat - minLat) || 0.02
    return {
      minLng: minLng - dLng * PAD,
      maxLng: maxLng + dLng * PAD,
      minLat: minLat - dLat * PAD,
      maxLat: maxLat + dLat * PAD,
    }
  }, [renderHotspots, route])

  const project = useMemo(() => {
    const w = bounds.maxLng - bounds.minLng || 1
    const h = bounds.maxLat - bounds.minLat || 1
    return (lng: number, lat: number) => ({
      x: ((lng - bounds.minLng) / w) * 100,
      y: (1 - (lat - bounds.minLat) / h) * 100,
    })
  }, [bounds])

  const routePts = useMemo(() => {
    if (!route || !showRoute) return ''
    return route.coordinates.map(([lng, lat]) => {
      const p = project(lng, lat)
      return `${p.x},${p.y}`
    }).join(' ')
  }, [route, showRoute, project])

  const markers = renderHotspots
  const viewLabel = smartRender ? getMapViewLabel(isAllStations) : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-btp-cyan/20 bg-civic-dusk shadow-command',
        className,
      )}
    >
      <div className="command-grid absolute inset-0 opacity-50" />
      <div className="aurora-orb -right-12 top-0 h-48 w-48 opacity-40" />
      <div className="aurora-orb -left-10 bottom-0 h-40 w-40 opacity-30" />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {routePts && (
          <>
            <polyline points={routePts} fill="none" stroke="rgba(249,115,22,0.25)" strokeWidth="1.4" />
            <polyline
              points={routePts}
              fill="none"
              stroke="#F97316"
              strokeWidth="0.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 1.4"
            />
          </>
        )}
      </svg>

      {/* markers */}
      <div className="absolute inset-0">
        {markers.map((h) => {
          const p = project(h.lng, h.lat)
          const color = classificationColor(h.classification)
          const tier = markerMeta.get(h.cluster_id)?.tier ?? 'hero'
          const size =
            tier === 'context'
              ? 4
              : tier === 'priority'
                ? 7 + Math.min(h.roi, 100) / 100 * 4
                : 9 + Math.min(h.roi, 100) / 100 * 8
          const isSel = h.cluster_id === selectedId
          const isHover = h.cluster_id === hover
          const opacity = tier === 'context' ? 0.32 : tier === 'priority' ? 0.88 : 1
          return (
            <button
              key={h.cluster_id}
              type="button"
              onClick={() => onSelect?.(h.cluster_id)}
              onMouseEnter={() => tier !== 'context' && setHover(h.cluster_id)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                'focus-ring-command absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform',
                tier !== 'context' && 'hover:scale-125',
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%`, opacity }}
              aria-label={`${h.cluster_id} ${h.classification}`}
            >
              <span
                className="block rounded-full"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  border: '1.5px solid rgba(247,242,232,0.85)',
                  boxShadow: isSel
                    ? `0 0 0 3px rgba(34,211,238,0.6), 0 0 14px ${color}`
                    : `0 0 8px ${color}aa`,
                }}
              />
              {(isHover || isSel) && (
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-btp-cyan/25 bg-civic-dusk/90 px-2 py-1 text-[9px] font-semibold text-civic-white backdrop-blur-sm">
                  {h.cluster_id} · {h.classification} · ROI {h.roi.toFixed(1)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5">
        <span className="w-fit rounded-full border border-btp-cyan/25 bg-civic-dusk/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-btp-cyan backdrop-blur-sm">
          Bengaluru Hotspot Command Map
        </span>
        {viewLabel && (
          <span className="w-fit rounded-full border border-btp-cyan/20 bg-civic-navy/75 px-2.5 py-1 text-[9px] font-semibold text-civic-ivory/75 backdrop-blur-sm">
            {viewLabel}
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10">
        <span className="rounded-full border border-status-amber/25 bg-civic-dusk/80 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-status-amber backdrop-blur-sm">
          Offline map mode
        </span>
      </div>
      <div className="absolute bottom-3 left-3 z-10">
        <MapLegend />
      </div>
    </div>
  )
}
