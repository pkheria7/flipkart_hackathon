import { Suspense, lazy, type ComponentType } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RouteFallback } from '@/components/layout/RouteFallback'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

/** Lazy-load a module's named export as a route component (keeps heavy deps off the initial bundle). */
function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(
  factory: () => Promise<M>,
  key: K,
) {
  return lazy(() => factory().then((m) => ({ default: m[key] as ComponentType })))
}

// Phase 8 — public entry + role-based routing
const HomePage = lazyNamed(() => import('@/pages/HomePage'), 'HomePage')
const AdminLoginPage = lazyNamed(() => import('@/pages/AdminLoginPage'), 'AdminLoginPage')
const StationLoginPage = lazyNamed(() => import('@/pages/StationLoginPage'), 'StationLoginPage')
const StationDashboardPage = lazyNamed(() => import('@/pages/StationDashboardPage'), 'StationDashboardPage')
const StationHotspotDetailPage = lazyNamed(() => import('@/pages/StationHotspotDetailPage'), 'StationHotspotDetailPage')

// Primary modules
const LandingPage = lazyNamed(() => import('@/pages/LandingPage'), 'LandingPage')
const CommandCenterPage = lazyNamed(() => import('@/pages/CommandCenterPage'), 'CommandCenterPage')
const IntelligencePage = lazyNamed(() => import('@/pages/IntelligencePage'), 'IntelligencePage')
const OperationsPage = lazyNamed(() => import('@/pages/OperationsPage'), 'OperationsPage')
const FeedbackEscalationPage = lazyNamed(() => import('@/pages/FeedbackEscalationPage'), 'FeedbackEscalationPage')
const ImpactPage = lazyNamed(() => import('@/pages/ImpactPage'), 'ImpactPage')
const DemoModePage = lazyNamed(() => import('@/pages/DemoModePage'), 'DemoModePage')
const HotspotDetailPage = lazyNamed(() => import('@/pages/HotspotDetailPage'), 'HotspotDetailPage')
const NotFoundPage = lazyNamed(() => import('@/pages/NotFoundPage'), 'NotFoundPage')

// Phase 0 legacy routes (not in sidebar)
const LoginPage = lazyNamed(() => import('@/pages/LoginPage'), 'LoginPage')
const PriorityBoardPage = lazyNamed(() => import('@/pages/PriorityBoardPage'), 'PriorityBoardPage')
const CityMapPage = lazyNamed(() => import('@/pages/CityMapPage'), 'CityMapPage')
const PatrolRoutesPage = lazyNamed(() => import('@/pages/PatrolRoutesPage'), 'PatrolRoutesPage')
const MasterPlanPage = lazyNamed(() => import('@/pages/MasterPlanPage'), 'MasterPlanPage')
const ApprovalPage = lazyNamed(() => import('@/pages/ApprovalPage'), 'ApprovalPage')
const NotificationsPage = lazyNamed(() => import('@/pages/NotificationsPage'), 'NotificationsPage')
const OfficerViewPage = lazyNamed(() => import('@/pages/OfficerViewPage'), 'OfficerViewPage')
const TowViewPage = lazyNamed(() => import('@/pages/TowViewPage'), 'TowViewPage')
const FeedbackPage = lazyNamed(() => import('@/pages/FeedbackPage'), 'FeedbackPage')
const EscalationPage = lazyNamed(() => import('@/pages/EscalationPage'), 'EscalationPage')
const WeekComparisonPage = lazyNamed(() => import('@/pages/WeekComparisonPage'), 'WeekComparisonPage')
const RunLogsPage = lazyNamed(() => import('@/pages/RunLogsPage'), 'RunLogsPage')
const ReportsPage = lazyNamed(() => import('@/pages/ReportsPage'), 'ReportsPage')

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Public entry (no app shell) ─────────────────────────── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login/admin" element={<AdminLoginPage />} />
        <Route path="/login/station" element={<StationLoginPage />} />
        {/* Legacy Phase 0 placeholder login — still reachable by URL */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Admin authenticated ─────────────────────────────────── */}
        <Route element={<ProtectedRoute requireRole="admin" />}>
          {/* Mission Brief — outside shell for full-bleed hero */}
          <Route path="/mission" element={<LandingPage />} />

          <Route element={<AppShell />}>
            {/* Phase 1 primary modules */}
            <Route path="/command" element={<CommandCenterPage />} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/feedback-escalation" element={<FeedbackEscalationPage />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="/demo" element={<DemoModePage />} />
            <Route path="/hotspots/:clusterId" element={<HotspotDetailPage />} />

            {/* Phase 0 legacy routes — still reachable by URL */}
            <Route path="/priority" element={<PriorityBoardPage />} />
            <Route path="/map" element={<CityMapPage />} />
            <Route path="/routes" element={<PatrolRoutesPage />} />
            <Route path="/master-plan" element={<MasterPlanPage />} />
            <Route path="/approval" element={<ApprovalPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/officer" element={<OfficerViewPage />} />
            <Route path="/tow" element={<TowViewPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/escalation" element={<EscalationPage />} />
            <Route path="/week-comparison" element={<WeekComparisonPage />} />
            <Route path="/run-logs" element={<RunLogsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>

        {/* ── Station authenticated (restricted, no admin shell) ───── */}
        <Route element={<ProtectedRoute requireRole="station" />}>
          <Route path="/station-dashboard" element={<StationDashboardPage />} />
          <Route path="/station-hotspot/:clusterId" element={<StationHotspotDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
