import { useQuery } from '@tanstack/react-query'
import { getRoutes } from '@/services/routeService'
import { CommandMap } from '@/components/map/CommandMap'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { toRouteLine } from '@/lib/routes'
import { useHotspots } from '@/hooks/useHotspots'

export function CityMapPage() {
  const { hotspots } = useHotspots()
  const { data: routesRes } = useQuery({
    queryKey: ['routes'],
    queryFn: getRoutes,
  })

  const route = toRouteLine(routesRes?.routes?.[0])

  return (
    <PageScaffold
      eyebrow="Intelligence"
      title="City Hotspot Map"
      description="Full MapLibre Bengaluru overlay with classification layers"
    >
      <CommandMap hotspots={hotspots} route={route} className="h-[520px]" />
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          Interactive hotspot drill-down, station boundaries, and LCLE/BCI tooltips.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
