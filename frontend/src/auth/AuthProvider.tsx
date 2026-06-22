import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthRole = 'admin' | 'station'

const ROLE_KEY = 'gridlock_auth_role'
const STATION_KEY = 'gridlock_station_id'
const USER_KEY = 'gridlock_auth_user'

interface AuthState {
  role: AuthRole | null
  stationId: string | null
  displayName: string | null
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  loginAdmin: (displayName?: string) => void
  loginStation: (stationId: string, displayName?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): AuthState {
  if (typeof window === 'undefined') {
    return { role: null, stationId: null, displayName: null }
  }
  try {
    const role = localStorage.getItem(ROLE_KEY) as AuthRole | null
    if (role !== 'admin' && role !== 'station') {
      return { role: null, stationId: null, displayName: null }
    }
    return {
      role,
      stationId: localStorage.getItem(STATION_KEY),
      displayName: localStorage.getItem(USER_KEY),
    }
  } catch {
    return { role: null, stationId: null, displayName: null }
  }
}

function persist(state: AuthState) {
  try {
    if (state.role) localStorage.setItem(ROLE_KEY, state.role)
    else localStorage.removeItem(ROLE_KEY)

    if (state.stationId) localStorage.setItem(STATION_KEY, state.stationId)
    else localStorage.removeItem(STATION_KEY)

    if (state.displayName) localStorage.setItem(USER_KEY, state.displayName)
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore — demo prototype only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readStoredAuth())

  const loginAdmin = useCallback((displayName = 'Command Admin') => {
    const next: AuthState = { role: 'admin', stationId: null, displayName }
    persist(next)
    setState(next)
  }, [])

  const loginStation = useCallback((stationId: string, displayName?: string) => {
    const next: AuthState = {
      role: 'station',
      stationId,
      displayName: displayName ?? `${stationId.replace(/_/g, ' ')} Officer`,
    }
    persist(next)
    setState(next)
  }, [])

  const logout = useCallback(() => {
    const next: AuthState = { role: null, stationId: null, displayName: null }
    persist(next)
    setState(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.role !== null,
      loginAdmin,
      loginStation,
      logout,
    }),
    [state, loginAdmin, loginStation, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
