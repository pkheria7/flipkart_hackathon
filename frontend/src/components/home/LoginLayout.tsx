import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { ThemeSelector } from '@/components/layout/ThemeSelector'
import { HomeVideoBackground } from '@/components/home/HomeVideoBackground'
import { fadeUp } from '@/lib/motion'

interface LoginLayoutProps {
  children: ReactNode
}

/** Shared full-screen auth scaffold: cinematic background, top bar, centered card. */
export function LoginLayout({ children }: LoginLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <HomeVideoBackground />

      <header className="relative z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link to="/" className="focus-ring-command flex items-center gap-2.5 rounded-lg">
            <BrandLogo size={34} />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">{APP_NAME}</p>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Parking Impact Intelligence
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSelector compact />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="w-full max-w-md">
          <Link
            to="/"
            className="focus-ring-command mb-4 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-white/75 transition-colors hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to homepage
          </Link>
          <div className="rounded-2xl border border-white/12 bg-[#0a1626]/85 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-7">
            {children}
          </div>
        </motion.div>
      </main>

      {/* Decorative chip — matches Mission Brief hero; also covers any residual corner mark */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-20 hidden sm:block">
        <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/25 bg-[#06111f]/90 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <BrandLogo size={28} />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold leading-tight text-white">GridLock Command</p>
            <p className="truncate text-[9px] font-medium uppercase tracking-wider text-cyan-300">
              Bengaluru Traffic Pulse
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
