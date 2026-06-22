import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/lib/motion'

interface TypewriterTextProps {
  text: string
  /** ms per character */
  speed?: number
  /** Begin typing only when true (used to sequence multiple lines). */
  start?: boolean
  className?: string
  /** Characters from this index onward render with `accentClassName`. */
  accentFromIndex?: number
  accentClassName?: string
  showCursor?: boolean
  /** Keep a blinking cursor after typing finishes (terminal "at rest" look). */
  keepCursor?: boolean
  cursorClassName?: string
  onComplete?: () => void
}

/**
 * Terminal-style typewriter. Renders an invisible full-text placeholder so the
 * surrounding layout never jumps while characters are revealed on top of it.
 * Respects prefers-reduced-motion by showing the full text instantly.
 */
export function TypewriterText({
  text,
  speed = 26,
  start = true,
  className,
  accentFromIndex,
  accentClassName,
  showCursor = true,
  keepCursor = false,
  cursorClassName,
  onComplete,
}: TypewriterTextProps) {
  const reduced = prefersReducedMotion()
  const [count, setCount] = useState(reduced ? text.length : 0)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!start) return
    if (reduced || count >= text.length) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete?.()
      }
      return
    }
    const id = window.setTimeout(() => setCount((c) => c + 1), speed)
    return () => window.clearTimeout(id)
  }, [start, count, text.length, speed, reduced, onComplete])

  const done = count >= text.length
  const cursorVisible = showCursor && start && (!done || keepCursor)

  const split = accentFromIndex ?? text.length
  const typed = text.slice(0, count)
  const head = typed.slice(0, Math.min(count, split))
  const tail = count > split ? typed.slice(split) : ''

  return (
    <span className={cn('relative inline-block', className)}>
      {/* placeholder reserves the final box → zero layout shift */}
      <span aria-hidden className="invisible">
        {text || '\u00A0'}
      </span>
      {/* revealed text overlay */}
      <span className="absolute inset-0 whitespace-pre-wrap" aria-label={text}>
        <span aria-hidden>{head}</span>
        {tail && (
          <span aria-hidden className={accentClassName}>
            {tail}
          </span>
        )}
        {cursorVisible && (
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            className={cn(
              'ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.12em] rounded-sm bg-cyan-300 align-baseline',
              cursorClassName,
            )}
          />
        )}
      </span>
    </span>
  )
}
