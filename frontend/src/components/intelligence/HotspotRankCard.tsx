import { motion } from 'framer-motion'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatStation } from '@/lib/formatters'
import type { CommandHotspot } from '@/lib/hotspots'
import { fadeUp } from '@/lib/motion'
import type { Classification } from '@/types/common'
import { RoiScorePill } from './RoiScorePill'
import { getHotspotDisplayName } from '@/lib/hotspotLabels'

interface HotspotRankCardProps {
  rank: number
  hotspot: CommandHotspot
  metric: 'roi' | 'violations'
  selected?: boolean
  onSelect?: (id: string) => void
  note?: string
}

export function HotspotRankCard({ rank, hotspot, metric, selected, onSelect, note }: HotspotRankCardProps) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      onClick={() => onSelect?.(hotspot.cluster_id)}
      className={cn(
        'focus-ring-command flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
        selected
          ? 'border-btp-cyan/40 bg-btp-blue/30 shadow-glow-cyan'
          : 'border-btp-cyan/10 bg-civic-navy/45 hover:border-btp-cyan/25 hover:bg-civic-white/5',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
          rank <= 3 ? 'bg-btp-cyan/15 text-btp-cyan' : 'bg-civic-white/5 text-civic-ivory/50',
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-civic-white">
              {getHotspotDisplayName(hotspot)}
            </span>
            <span className="font-mono text-[9px] text-btp-cyan/50">{hotspot.cluster_id}</span>
          </span>
          {hotspot.classification !== 'UNKNOWN' && (
            <StatusBadge status={hotspot.classification as Classification} className="shrink-0 !px-1.5 !py-0 !text-[8px]" />
          )}
        </div>
        <p className="truncate text-[10px] text-civic-ivory/50">
          {formatStation(hotspot.station)}
          {note ? ` · ${note}` : ''}
        </p>
      </div>
      {metric === 'roi' ? (
        <RoiScorePill value={hotspot.roi} />
      ) : (
        <span className="shrink-0 text-sm font-bold tabular-nums text-status-amber">
          {hotspot.violations.toLocaleString('en-IN')}
        </span>
      )}
    </motion.button>
  )
}
