import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { prefersReducedMotion } from '@/lib/motion'

interface CountUpNumberProps {
  value: number
  className?: string
  duration?: number
}

/** Animates a number from 0 → value with Indian locale formatting when in viewport. */
export function CountUpNumber({ value, className, duration = 1.15 }: CountUpNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-48px' })
  const reduced = prefersReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  const animated = useRef(false)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setDisplay(value)
      return
    }
    if (animated.current) {
      setDisplay(value)
      return
    }
    animated.current = true

    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, value, reduced, duration])

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('en-IN')}
    </span>
  )
}
