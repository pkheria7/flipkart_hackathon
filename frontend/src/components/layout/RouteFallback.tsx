import { Loader2 } from 'lucide-react'

export function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-civic-ivory/70">
        <Loader2 className="h-7 w-7 animate-spin text-btp-cyan" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-btp-cyan/80">
          Loading module…
        </p>
      </div>
    </div>
  )
}
