import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type AuthRole } from '@/auth/AuthProvider'

interface ProtectedRouteProps {
  requireRole: AuthRole
}

/**
 * Demo route guard for the prototype.
 * - Unauthenticated users are sent to the matching login page.
 * - Cross-role access is redirected to that role's home (station ↔ admin),
 *   so a station officer can never land on the full admin shell and vice-versa.
 */
export function ProtectedRoute({ requireRole }: ProtectedRouteProps) {
  const { role, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const loginPath = requireRole === 'station' ? '/login/station' : '/login/admin'
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />
  }

  if (role !== requireRole) {
    const home = role === 'station' ? '/station-dashboard' : '/mission'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
