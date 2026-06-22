import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ChevronDown, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { LoginLayout } from '@/components/home/LoginLayout'
import { formatStationShort } from '@/lib/formatters'
import { useHotspots } from '@/hooks/useHotspots'
import { getStationsWithHotspots } from '@/lib/stationHelpers'

const DEMO_PASS = 'station'
const STATION_HOME = '/station-dashboard'

export function StationLoginPage() {
  const navigate = useNavigate()
  const { loginStation } = useAuth()
  const [stationId, setStationId] = useState<string>('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { hotspots, isLoading } = useHotspots()

  const stationOptions = useMemo(() => getStationsWithHotspots(hotspots).slice(0, 12), [hotspots])

  // Default to the top station once data is loaded
  useEffect(() => {
    if (stationOptions.length > 0 && !stationId) {
      setStationId(stationOptions[0].id)
    }
  }, [stationOptions, stationId])

  const enter = (id: string) => {
    if (!id) return
    loginStation(id)
    navigate(STATION_HOME, { replace: true })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!stationId) {
      setError('Select a station to continue.')
      return
    }
    if (password === DEMO_PASS) {
      enter(stationId)
      return
    }
    setError('Invalid demo credentials. Password is "station".')
  }

  return (
    <LoginLayout>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-white">Traffic Station Login</h1>
          <p className="text-xs text-white/65">Open station-specific enforcement priorities.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label htmlFor="station-select" className="block">
          <span className="mb-1.5 block text-xs font-semibold text-white/70">Station</span>
          {isLoading ? (
            <div className="h-10 w-full animate-pulse rounded-xl border border-white/12 bg-white/5" />
          ) : (
            <div className="relative">
              <select
                id="station-select"
                value={stationId}
                onChange={(e) => {
                  setStationId(e.target.value)
                  setError('')
                }}
                className="focus-ring-command w-full cursor-pointer appearance-none rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white"
              >
                {stationOptions.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0a1626] text-white">
                    {formatStationShort(s.id)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            </div>
          )}
        </label>

        <label htmlFor="station-password" className="block">
          <span className="mb-1.5 block text-xs font-semibold text-white/70">Password</span>
          <input
            id="station-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            placeholder="••••••••"
            className="focus-ring-command w-full rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35"
          />
        </label>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
            {error}
          </p>
        )}

        <p className="text-[11px] text-white/50">Demo password: station</p>

        <button
          type="submit"
          disabled={isLoading || !stationId}
          className="focus-ring-command inline-flex w-full items-center justify-center gap-2 rounded-xl bg-btp-blue px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Open Station Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={isLoading || !stationId}
          onClick={() => enter(stationId)}
          className="focus-ring-command inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-cyan-400/45 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-4 w-4 text-cyan-300" />
          Use demo station
        </button>
      </form>
    </LoginLayout>
  )
}
