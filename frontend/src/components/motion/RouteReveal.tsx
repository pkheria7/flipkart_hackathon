import { motion } from 'framer-motion'

interface RouteRevealProps {
  stopCount?: number
}

export function RouteReveal({ stopCount = 0 }: RouteRevealProps) {
  return (
    <motion.div
      className="mt-3 overflow-hidden rounded-xl border border-btp-cyan/20 bg-civic-navy/5 p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <svg viewBox="0 0 200 40" className="h-10 w-full" aria-hidden>
        <motion.path
          d="M 10 30 Q 60 10, 110 25 T 190 15"
          fill="none"
          stroke="#F97316"
          strokeWidth="2"
          strokeDasharray="6 3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        {Array.from({ length: Math.min(stopCount, 6) }).map((_, i) => (
          <motion.circle
            key={i}
            cx={10 + i * 35}
            cy={30 - (i % 2) * 12}
            r="3"
            fill="#22D3EE"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          />
        ))}
      </svg>
      <p className="mt-1 text-center text-[10px] font-medium text-civic-graphite">
        Patrol route sequence — {stopCount} stops
      </p>
    </motion.div>
  )
}
