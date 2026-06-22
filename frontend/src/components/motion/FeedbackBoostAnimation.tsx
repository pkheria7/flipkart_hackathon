import { motion } from 'framer-motion'
import { FileWarning, RefreshCw, ShieldAlert, Siren } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FeedbackBoostAnimationProps {
  /** Drives the amber→red morph. True when boost is active (real or preview). */
  active?: boolean
  preview?: boolean
}

const AMBER = '#F59E0B'
const RED = '#D62828'

const NODES = [
  { id: 'recurred', icon: RefreshCw, title: 'Enforced but recurred', sub: 'officer outcome = recurred' },
  { id: 'boost', icon: ShieldAlert, title: 'feedback_structural_boost = 1', sub: 'learning signal raised' },
  { id: 'watch', icon: Siren, title: 'STRUCTURAL WATCH', sub: 'classification under review' },
  { id: 'escalation', icon: FileWarning, title: 'Escalation candidate', sub: 'BBMP / BTP brief' },
]

function Connector({ active, index }: { active: boolean; index: number }) {
  return (
    <div className="flex items-center justify-center md:flex-1">
      <motion.div
        initial={false}
        animate={{
          opacity: active ? 1 : 0.25,
          backgroundColor: active ? RED : '#1E3A5F',
        }}
        transition={{ duration: 0.5, delay: active ? 0.3 + index * 0.25 : 0 }}
        className="h-6 w-0.5 rounded-full md:h-0.5 md:w-full"
        style={{ boxShadow: active ? `0 0 12px ${RED}66` : 'none' }}
      />
    </div>
  )
}

export function FeedbackBoostAnimation({ active = false, preview = false }: FeedbackBoostAnimationProps) {
  return (
    <div className="rounded-2xl border border-btp-cyan/15 bg-civic-dusk/70 p-5">
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {NODES.map((node, i) => {
          const Icon = node.icon
          const isRecurred = node.id === 'recurred'
          const isWatch = node.id === 'watch'
          const isEscalation = node.id === 'escalation'

          // Base tone per node
          const baseTone = isRecurred
            ? 'border-status-amber/30 bg-status-amber/10 text-status-amber'
            : node.id === 'boost'
              ? 'border-btp-cyan/30 bg-btp-cyan/10 text-btp-cyan'
              : 'border-civic-ivory/15 bg-civic-white/5 text-civic-ivory/55'

          return (
            <div key={node.id} className="contents md:flex md:flex-1 md:items-center">
              <motion.div
                initial={false}
                animate={
                  isWatch && active
                    ? { borderColor: `${RED}55`, backgroundColor: `${RED}1A`, color: RED }
                    : {}
                }
                transition={{ duration: 0.5, delay: 0.55 }}
                className={cn(
                  'relative flex-1 rounded-xl border p-3 text-center',
                  (!isWatch || !active) && baseTone,
                )}
              >
                {/* recurrence pulse halo */}
                {isRecurred && active && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: `0 0 0 2px ${AMBER}` }}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.08 }}
                    transition={{ duration: 0.9, repeat: 1, ease: 'easeOut' }}
                  />
                )}
                {/* escalation glow when active */}
                <motion.div
                  initial={false}
                  animate={isEscalation && active ? { scale: [1, 1.04, 1] } : {}}
                  transition={{ duration: 0.8, delay: 0.9 }}
                  className="flex flex-col items-center"
                >
                  <Icon className="mb-1 h-5 w-5" />
                  <p className="text-[11px] font-bold leading-tight">{node.title}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wide opacity-70">{node.sub}</p>
                </motion.div>
              </motion.div>

              {i < NODES.length - 1 && <Connector active={active} index={i} />}
            </div>
          )
        })}
      </div>

      {preview && active && (
        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-status-amber">
          Preview — local UI state only, not backend data
        </p>
      )}
    </div>
  )
}
