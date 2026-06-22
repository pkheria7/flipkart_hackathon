import type { PatrolRoute } from '@/types/route'

interface RouteLayerProps {
  routes: PatrolRoute[]
}

export function RouteLayer({ routes }: RouteLayerProps) {
  if (routes.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <polyline
        points="10%,50% 30%,40% 50%,55% 70%,35% 90%,45%"
        fill="none"
        stroke="rgba(26, 75, 140, 0.4)"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <text x="50%" y="90%" textAnchor="middle" className="fill-slate-400 text-[10px]">
        {routes.length} route(s) — placeholder layer
      </text>
    </svg>
  )
}
