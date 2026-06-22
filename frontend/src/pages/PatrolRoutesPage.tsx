import { useQuery } from '@tanstack/react-query'
import { getRoutes } from '@/services/routeService'
import { RouteReveal } from '@/components/motion/RouteReveal'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function PatrolRoutesPage() {
  const { data: routesRes } = useQuery({
    queryKey: ['routes'],
    queryFn: getRoutes,
  })
  const routes = routesRes?.routes ?? []

  return (
    <PageScaffold
      eyebrow="Operations"
      title="Patrol Route Optimizer"
      description="OSM graph VRP routes with stop sequencing — Phase 4"
    >
      {routes.map((route) => (
        <GlassCard key={route.route_id ?? route.assigned_station} className="mb-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-800">{route.route_id}</p>
            <span className="text-xs text-slate-500">{String(route.routing_mode ?? '—')}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {route.assigned_station} · {route.stops?.length ?? route.stop_count ?? 0} stops ·{' '}
            {route.estimated_route_km != null ? Number(route.estimated_route_km).toFixed(1) : '—'} km
          </p>
          <div className="mt-3">
            <RouteReveal stopCount={route.stops?.length ?? 0} />
          </div>
        </GlassCard>
      ))}
    </PageScaffold>
  )
}
