import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { LoginLayout } from '@/components/home/LoginLayout'

const DEMO_USER = 'admin'
const DEMO_PASS = 'gridlock'
const ADMIN_HOME = '/mission'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { loginAdmin } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const enter = (name: string) => {
    loginAdmin(name)
    navigate(ADMIN_HOME, { replace: true })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (username.trim().toLowerCase() === DEMO_USER && password === DEMO_PASS) {
      enter('Command Admin')
      return
    }
    setError('Invalid demo credentials. Try admin / gridlock.')
  }

  return (
    <LoginLayout>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-white">Admin Login</h1>
          <p className="text-xs text-white/65">Enter the full GridLock Command Center.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Username" htmlFor="admin-username">
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
            placeholder="admin"
            className="focus-ring-command w-full rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35"
          />
        </Field>

        <Field label="Password" htmlFor="admin-password">
          <input
            id="admin-password"
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
        </Field>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
            {error}
          </p>
        )}

        <p className="text-[11px] text-white/50">Demo: admin / gridlock</p>

        <button
          type="submit"
          className="focus-ring-command inline-flex w-full items-center justify-center gap-2 rounded-xl bg-btp-blue px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-glow-cyan"
        >
          Enter Command Center
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => enter('Demo Admin')}
          className="focus-ring-command inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-cyan-400/45 hover:bg-white/10"
        >
          <Sparkles className="h-4 w-4 text-cyan-300" />
          Use demo admin
        </button>
      </form>
    </LoginLayout>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-xs font-semibold text-white/70">{label}</span>
      {children}
    </label>
  )
}
