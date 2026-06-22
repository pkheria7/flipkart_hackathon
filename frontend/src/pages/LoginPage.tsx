import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/motion/PageTransition'
import { CommandButton } from '@/components/ui/CommandButton'
import { GlassCard } from '@/components/ui/GlassCard'

export function LoginPage() {
  return (
    <PageTransition>
      <div className="flex min-h-screen items-center justify-center px-4">
        <GlassCard className="w-full max-w-md space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-btp-blue/70">
              BTP Head Officer
            </p>
            <h1 className="mt-1 text-xl font-semibold text-civic-ink">
              Sign in to GridLock Command
            </h1>
            <p className="mt-2 text-sm text-civic-graphite">
              Placeholder login — no authentication in Phase 0.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="officer@btp.karnataka.gov.in"
              className="focus-ring-command w-full rounded-xl border border-civic-ink/10 bg-civic-white px-4 py-2.5 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              className="focus-ring-command w-full rounded-xl border border-civic-ink/10 bg-civic-white px-4 py-2.5 text-sm"
            />
          </div>
          <Link to="/command">
            <CommandButton className="w-full">Continue to Command Center</CommandButton>
          </Link>
        </GlassCard>
      </div>
    </PageTransition>
  )
}
