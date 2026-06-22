import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Route as RouteIcon } from 'lucide-react'
import { CommandMap } from '@/components/map/CommandMap'
import { cn } from '@/lib/cn'
import { formatPatrolWindow } from '@/lib/timezone'
import { toRouteLine, routeStopHotspots } from '@/lib/routes'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { ApiPatrolRoute } from '@/types/api'

interface RouteMapPanelProps {
  route: ApiPatrolRoute | null
  className?: string
}

export function RouteMapPanel({ route, className }: RouteMapPanelProps) {
  const routeLine = useMemo(() => toRouteLine(route), [route])
  const stopHotspots = useMemo(() => routeStopHotspots(route), [route])
  const station = String(route?.assigned_station ?? '')

  if (!route) {
    return (
      <div className={cn('flex items-center justify-center rounded-2xl border border-dashed border-btp-cyan/20 bg-civic-navy/40 text-sm text-civic-ivory/55', className)}>
        Select a station to view its patrol route.
      </div>
    )
  }

  // Real geometry available → MapLibre station view.
  if (routeLine && stopHotspots.length > 0) {
    return (
      <div className={cn('relative', className)}>
        <CommandMap
          hotspots={stopHotspots}
          route={routeLine}
          showRoute
          fitKey={station}
          className="h-full w-full"
        />
      </div>
    )
  }

  // No coordinates → premium route-sequence visualization.
  const stops = route.stops ?? []
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-btp-cyan/20 bg-civic-dusk p-5 shadow-command', className)}>
      <div className="command-grid absolute inset-0 opacity-40" />
      <div className="aurora-orb -right-10 top-0 h-40 w-40 opacity-30" />
      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-status-route">
          <RouteIcon className="h-4 w-4" />
          Route sequence · {route.route_id}
        </p>
        <p className="mt-1 text-[11px] text-civic-ivory/50">
          Map geometry unavailable — showing M10 stop order.
        </p>

        <div className="relative mt-6">
          <div className="absolute left-0 right-0 top-5 h-px bg-status-route/20" />
          <motion.div
            className="absolute top-5 h-px bg-status-route"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
          <motion.ol
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative flex gap-4 overflow-x-auto pb-2 scrollbar-thin"
          >
            {stops.map((s, i) => (
              <motion.li key={`${s.cluster_id}-${i}`} variants={fadeUp} className="flex w-24 shrink-0 flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-status-route/50 bg-status-route/15 text-sm font-bold text-status-route">
                  {Number(s.sequence ?? s.order ?? i + 1)}
                </span>
                <span className="mt-2 truncate text-xs font-semibold text-civic-white">{String(s.cluster_id ?? '—')}</span>
                <span className="text-[10px] text-civic-ivory/50">
                  {formatPatrolWindow(s.peak_window) ?? s.peak_window ?? ''}
                </span>
              </motion.li>
            ))}
          </motion.ol>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-civic-ivory/45">
          <MapPin className="h-3 w-3" />
          Route metadata ready · {stops.length} stops
        </p>
      </div>
    </div>
  )
}
