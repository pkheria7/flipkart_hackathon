import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { RouteFallback } from './RouteFallback'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = () => {
      if (mq.matches) setMobileOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="relative flex h-screen overflow-hidden bg-app">
      <div className="aurora-bg" />
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 backdrop-blur-sm lg:hidden"
          style={{ backgroundColor: 'var(--overlay-scrim)' }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close overlay"
        />
      )}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => {
            setMobileOpen((v) => !v)
            setCollapsed(false)
          }}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="page-container">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="focus-ring-command fixed bottom-4 left-4 z-20 hidden rounded-full border border-btp-cyan/20 bg-civic-navy/80 px-3 py-1.5 text-xs font-medium text-civic-ivory/80 shadow-command backdrop-blur md:block lg:hidden"
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
    </div>
  )
}
