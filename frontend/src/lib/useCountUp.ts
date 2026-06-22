import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Animate a number from 0 → target over `duration` ms (default 600ms).
 * Respects prefers-reduced-motion (returns the target immediately).
 */
export function useCountUp(target: number, duration = 600): number {
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduced) return

    let start: number | null = null

    const tick = (now: number) => {
      if (start === null) start = now
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, reduced])

  return reduced ? target : value
}
