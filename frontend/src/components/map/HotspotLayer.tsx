import type { Hotspot } from '@/types/hotspot'

interface HotspotLayerProps {
  hotspots: Hotspot[]
}

export function HotspotLayer({ hotspots }: HotspotLayerProps) {
  if (hotspots.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {hotspots.slice(0, 5).map((h, i) => (
        <div
          key={h.cluster_id}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-btp-cyan/40 ring-2 ring-civic-white"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 15}%`,
          }}
        />
      ))}
    </div>
  )
}
