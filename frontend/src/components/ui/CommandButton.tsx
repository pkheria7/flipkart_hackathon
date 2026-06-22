import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { softSpring } from '@/lib/motion'

const buttonVariants = cva(
  'focus-ring-command inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-btp-blue text-civic-white shadow-soft hover:bg-btp-signal hover:shadow-glow-cyan',
        cyan: 'bg-btp-cyan text-civic-navy shadow-soft hover:bg-btp-cyan/90 hover:shadow-glow-cyan',
        secondary:
          'border border-btp-cyan/25 bg-civic-white/5 text-civic-white backdrop-blur hover:bg-civic-white/10 hover:border-btp-cyan/40',
        ghost: 'text-civic-ivory/70 hover:bg-civic-white/5 hover:text-civic-white',
        amber: 'bg-status-amber text-civic-ink shadow-soft hover:bg-status-amber/90 hover:shadow-glow-amber',
        structural:
          'bg-status-structural text-on-primary hover:bg-status-structural/90 hover:shadow-glow-red',
        danger: 'bg-status-structural text-on-primary hover:bg-status-structural/90',
      },
      size: {
        default: 'h-10',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

interface CommandButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function CommandButton({
  className,
  variant,
  size,
  children,
  ...props
}: CommandButtonProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={softSpring}
      className="inline-flex"
    >
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    </motion.div>
  )
}
