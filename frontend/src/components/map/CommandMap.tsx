import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
  StyleSpecification,
} from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cn } from '@/lib/cn'
import { CLASSIFICATION_HEX, NEUTRAL_HEX, type CommandHotspot, type RouteLine } from '@/lib/hotspots'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'
import {
  flattenPartitionForBounds,
  getMapViewLabel,
  partitionMapMarkers,
  type MapBounds,
  type MapMarkerPartition,
  type MarkerTier,
} from '@/lib/mapMarkerStrategy'
import { CommandMapFallback } from './CommandMapFallback'
import { MapLegend } from './MapLegend'

interface CommandMapProps {
  hotspots: CommandHotspot[]
  route?: RouteLine | null
  selectedId?: string | null
  showHotspots?: boolean
  showRoute?: boolean
  onSelect?: (id: string) => void
  className?: string
  interactive?: boolean
  fitKey?: string
  smartRender?: boolean
  isAllStations?: boolean
}

const BLR: [number, number] = [77.5946, 12.9716]

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#06111F' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.9 } },
  ],
}

const COLOR_EXPR = [
  'match',
  ['get', 'classification'],
  'STRUCTURAL',
  CLASSIFICATION_HEX.STRUCTURAL,
  'RESPONSIVE',
  CLASSIFICATION_HEX.RESPONSIVE,
  'SEASONAL',
  CLASSIFICATION_HEX.SEASONAL,
  NEUTRAL_HEX,
] as unknown as ExpressionSpecification

const TIER_RADIUS = [
  'match',
  ['get', 'tier'],
  'hero',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 6, 50, 9, 100, 13],
  'selected',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 8, 50, 11, 100, 15],
  'priority',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 4, 50, 5.5, 100, 8],
  'context',
  1.8,
  5,
] as unknown as ExpressionSpecification

const TIER_GLOW_RADIUS = [
  'match',
  ['get', 'tier'],
  'hero',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 11, 50, 16, 100, 22],
  'selected',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 14, 50, 18, 100, 24],
  'priority',
  ['interpolate', ['linear'], ['get', 'roi'], 0, 7, 50, 10, 100, 14],
  'context',
  0,
  8,
] as unknown as ExpressionSpecification

const TIER_CORE_OPACITY = [
  'match',
  ['get', 'tier'],
  'context',
  0.3,
  'priority',
  0.88,
  'hero',
  0.96,
  'selected',
  1,
  0.9,
] as unknown as ExpressionSpecification

const LEGACY_CORE_RADIUS = [
  'interpolate',
  ['linear'],
  ['get', 'roi'],
  0, 4, 50, 7, 100, 13,
] as unknown as ExpressionSpecification

const LEGACY_GLOW_RADIUS = [
  'interpolate',
  ['linear'],
  ['get', 'roi'],
  0, 9, 50, 15, 100, 27,
] as unknown as ExpressionSpecification

const SELECTED_RADIUS = [
  'interpolate',
  ['linear'],
  ['get', 'roi'],
  0, 10, 50, 13, 100, 19,
] as unknown as ExpressionSpecification

const INTERACTIVE_TIER_FILTER = [
  'in',
  ['get', 'tier'],
  ['literal', ['hero', 'priority', 'selected']],
] as unknown as FilterSpecification

function featureFromHotspot(h: CommandHotspot, tier: MarkerTier) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [h.lng, h.lat] },
    properties: {
      cluster_id: h.cluster_id,
      display_name: getHotspotDisplayName(h),
      classification: h.classification,
      roi: h.roi,
      station: h.station,
      tier,
    },
  }
}

function buildLegacyCollection(hotspots: CommandHotspot[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((h) => featureFromHotspot(h, 'hero')),
  }
}

function buildTieredCollection(partition: MapMarkerPartition): FeatureCollection {
  const features = [
    ...partition.context.map((h) => featureFromHotspot(h, 'context')),
    ...partition.priority.map((h) => featureFromHotspot(h, 'priority')),
    ...partition.hero.map((h) => featureFromHotspot(h, 'hero')),
  ]
  if (partition.selectedOverlay) {
    features.push(featureFromHotspot(partition.selectedOverlay, 'selected'))
  }
  return { type: 'FeatureCollection', features }
}

function buildRouteCollection(route: RouteLine | null | undefined): FeatureCollection {
  if (!route) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: route.coordinates },
        properties: {},
      },
      ...route.stops.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: { order: s.order },
      })),
    ],
  }
}

function readMapBounds(map: maplibregl.Map): MapBounds {
  const b = map.getBounds()
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  }
}

export function CommandMap({
  hotspots,
  route,
  selectedId,
  showHotspots = true,
  showRoute = true,
  onSelect,
  className,
  interactive = true,
  fitKey,
  smartRender = false,
  isAllStations = true,
}: CommandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(10.6)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const didFitRef = useRef(false)

  const partition = useMemo(() => {
    if (!smartRender) return null
    return partitionMapMarkers(hotspots, {
      isAllStations,
      selectedId: selectedId ?? null,
      zoom,
      bounds: mapBounds,
    })
  }, [hotspots, smartRender, isAllStations, selectedId, zoom, mapBounds])

  const mapDataHotspots = useMemo(() => {
    if (!smartRender || !partition) return hotspots
    return flattenPartitionForBounds(partition)
  }, [hotspots, smartRender, partition])

  const geoJson = useMemo(() => {
    if (!showHotspots) return buildLegacyCollection([])
    if (smartRender && partition) return buildTieredCollection(partition)
    return buildLegacyCollection(hotspots)
  }, [showHotspots, smartRender, partition, hotspots])

  useEffect(() => {
    if (!containerRef.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: BLR,
        zoom: 10.6,
        attributionControl: false,
        interactive,
      })
    } catch {
      setFailed(true)
      return
    }
    mapRef.current = map

    map.on('error', () => {
      /* tile errors are non-fatal */
    })

    const syncViewport = () => {
      setZoom(map.getZoom())
      setMapBounds(readMapBounds(map))
    }

    map.on('load', () => {
      map.addSource('hotspots', { type: 'geojson', data: buildLegacyCollection([]) })
      map.addSource('route', { type: 'geojson', data: buildRouteCollection(null) })

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        filter: ['==', ['geometry-type'], 'LineString'] as unknown as FilterSpecification,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#F97316',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1.4],
        },
      })
      map.addLayer({
        id: 'route-stops',
        type: 'circle',
        source: 'route',
        filter: ['==', ['geometry-type'], 'Point'] as unknown as FilterSpecification,
        paint: {
          'circle-radius': 4,
          'circle-color': '#22D3EE',
          'circle-stroke-color': '#06111F',
          'circle-stroke-width': 1.5,
        },
      })

      map.addLayer({
        id: 'hotspot-context',
        type: 'circle',
        source: 'hotspots',
        filter: ['==', ['get', 'tier'], 'context'] as unknown as FilterSpecification,
        paint: {
          'circle-radius': 1.8,
          'circle-color': COLOR_EXPR,
          'circle-opacity': 0.3,
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: 'hotspot-glow',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': LEGACY_GLOW_RADIUS,
          'circle-color': COLOR_EXPR,
          'circle-blur': 1,
          'circle-opacity': 0.28,
        },
      })
      map.addLayer({
        id: 'hotspot-core',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': LEGACY_CORE_RADIUS,
          'circle-color': COLOR_EXPR,
          'circle-stroke-color': '#F7F2E8',
          'circle-stroke-width': 1,
          'circle-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'hotspot-selected',
        type: 'circle',
        source: 'hotspots',
        filter: ['==', ['get', 'cluster_id'], '___none___'] as unknown as FilterSpecification,
        paint: {
          'circle-radius': SELECTED_RADIUS,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': '#22D3EE',
          'circle-stroke-width': 2.5,
        },
      })

      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'cmd-popup',
        offset: 12,
      })

      const onMove = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined
        if (!f || !popupRef.current) return
        map.getCanvas().style.cursor = 'pointer'
        const p = f.properties as { cluster_id: string; display_name?: string; classification: string; roi: number }
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="cmd-popup-title">${p.display_name ?? p.cluster_id}</div>` +
              `<div class="cmd-popup-id">${p.cluster_id}</div>` +
              `<div class="cmd-popup-row"><span>${p.classification}</span><span>ROI ${Number(
                p.roi,
              ).toFixed(1)}</span></div>`,
          )
          .addTo(map)
      }
      const onLeave = () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      }
      map.on('mousemove', 'hotspot-core', onMove)
      map.on('mouseleave', 'hotspot-core', onLeave)
      map.on('click', 'hotspot-core', (e) => {
        const f = e.features?.[0]
        const id = f?.properties?.cluster_id as string | undefined
        if (id && onSelect) onSelect(id)
      })

      if (interactive) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      }

      syncViewport()
      setReady(true)
    })

    map.on('moveend', syncViewport)
    map.on('zoomend', syncViewport)

    let raf = 0
    const pulse = () => {
      const m = mapRef.current
      if (m && m.getLayer('hotspot-glow')) {
        const t = (Math.sin(Date.now() / 650) + 1) / 2
        m.setPaintProperty('hotspot-glow', 'circle-opacity', 0.14 + t * 0.18)
      }
      raf = requestAnimationFrame(pulse)
    }
    raf = requestAnimationFrame(pulse)

    return () => {
      cancelAnimationFrame(raf)
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('hotspot-core')) return

    if (smartRender) {
      map.setLayoutProperty('hotspot-context', 'visibility', 'visible')
      map.setFilter('hotspot-glow', [
        'in',
        ['get', 'tier'],
        ['literal', ['hero', 'priority', 'selected']],
      ] as unknown as FilterSpecification)
      map.setFilter('hotspot-core', INTERACTIVE_TIER_FILTER)
      map.setPaintProperty('hotspot-glow', 'circle-radius', TIER_GLOW_RADIUS)
      map.setPaintProperty('hotspot-glow', 'circle-blur', 0.85)
      map.setPaintProperty('hotspot-core', 'circle-radius', TIER_RADIUS)
      map.setPaintProperty('hotspot-core', 'circle-opacity', TIER_CORE_OPACITY)
      map.setPaintProperty('hotspot-core', 'circle-stroke-width', [
        'match',
        ['get', 'tier'],
        'selected',
        2,
        'hero',
        1.2,
        1,
      ] as unknown as ExpressionSpecification)
    } else {
      map.setLayoutProperty('hotspot-context', 'visibility', 'none')
      map.setFilter('hotspot-glow', null)
      map.setFilter('hotspot-core', null)
      map.setPaintProperty('hotspot-glow', 'circle-radius', LEGACY_GLOW_RADIUS)
      map.setPaintProperty('hotspot-glow', 'circle-blur', 1)
      map.setPaintProperty('hotspot-core', 'circle-radius', LEGACY_CORE_RADIUS)
      map.setPaintProperty('hotspot-core', 'circle-opacity', 0.95)
      map.setPaintProperty('hotspot-core', 'circle-stroke-width', 1)
    }
  }, [smartRender, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('hotspots') as GeoJSONSource | undefined
    src?.setData(geoJson)

    if (!didFitRef.current && mapDataHotspots.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      mapDataHotspots.forEach((h) => bounds.extend([h.lng, h.lat]))
      try {
        map.fitBounds(bounds, { padding: 60, maxZoom: smartRender && isAllStations ? 11.5 : 13, duration: 600 })
        didFitRef.current = true
      } catch {
        /* ignore */
      }
    }
  }, [geoJson, mapDataHotspots, showHotspots, ready, smartRender, isAllStations])

  useEffect(() => {
    didFitRef.current = false
  }, [fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('route') as GeoJSONSource | undefined
    src?.setData(buildRouteCollection(showRoute ? route : null))
  }, [route, showRoute, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || fitKey === undefined || mapDataHotspots.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    mapDataHotspots.forEach((h) => bounds.extend([h.lng, h.lat]))
    try {
      map.fitBounds(bounds, {
        padding: 56,
        maxZoom: smartRender && isAllStations ? 12 : 14,
        duration: 600,
      })
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('hotspot-selected')) return
    map.setFilter(
      'hotspot-selected',
      ['==', ['get', 'cluster_id'], selectedId ?? '___none___'] as unknown as FilterSpecification,
    )
  }, [selectedId, ready])

  if (failed) {
    return (
      <CommandMapFallback
        hotspots={hotspots}
        route={route}
        selectedId={selectedId}
        showHotspots={showHotspots}
        showRoute={showRoute}
        onSelect={onSelect}
        className={className}
        smartRender={smartRender}
        isAllStations={isAllStations}
      />
    )
  }

  const viewLabel = smartRender ? getMapViewLabel(isAllStations) : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-btp-cyan/20 bg-civic-dusk shadow-command',
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-5rem)] flex-col gap-1.5">
        <span className="w-fit rounded-full border border-btp-cyan/25 bg-civic-dusk/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-btp-cyan backdrop-blur-sm">
          Bengaluru Hotspot Command Map
        </span>
        {viewLabel && (
          <span className="w-fit rounded-full border border-btp-cyan/20 bg-civic-navy/75 px-2.5 py-1 text-[9px] font-semibold text-civic-ivory/75 backdrop-blur-sm">
            {viewLabel}
          </span>
        )}
      </div>
      {smartRender && isAllStations && (
        <p className="pointer-events-none absolute bottom-14 left-3 right-3 z-10 hidden text-[9px] leading-snug text-civic-ivory/45 sm:block">
          City overview highlights highest ROI clusters while preserving full distribution context.
        </p>
      )}
      <div className="absolute bottom-3 left-3 z-10">
        <MapLegend />
      </div>
    </div>
  )
}
