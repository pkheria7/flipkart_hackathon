import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, CheckSquare, Clock, Gauge, MapPin, Route as RouteIcon } from 'lucide-react'
import { getRoutes } from '@/services/routeService'
import {
  getDailyMasterPlan,
  getPendingMasterPlan,
  getApprovedMasterPlan,
} from '@/services/masterPlanService'
import { getNotifications } from '@/services/notificationService'
import { getSummary } from '@/services/summaryService'
import { getAgentState } from '@/services/agentService'
import { ModuleTabs } from '@/components/ui/ModuleTabs'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/formatters'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { normalizeMasterPlan } from '@/lib/masterPlan'
import { OperationsWorkflowStrip } from '@/components/operations/OperationsWorkflowStrip'
import { RoutePlannerPanel } from '@/components/operations/RoutePlannerPanel'
import { MasterPlanInbox } from '@/components/operations/MasterPlanInbox'
import { ApprovalConsole } from '@/components/operations/ApprovalConsole'
import { DispatchPreview } from '@/components/operations/DispatchPreview'

export function OperationsPage() {
  const routesQ = useQuery({ queryKey: ['routes'], queryFn: getRoutes })
  const dailyQ = useQuery({ queryKey: ['dailyMasterPlan'], queryFn: getDailyMasterPlan })
  const pendingQ = useQuery({ queryKey: ['pendingMasterPlan'], queryFn: getPendingMasterPlan })
  const approvedQ = useQuery({ queryKey: ['approvedMasterPlan'], queryFn: getApprovedMasterPlan })
  const notifQ = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications(50) })
  const summaryQ = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const agentQ = useQuery({ queryKey: ['agentState'], queryFn: getAgentState })

  const routes = routesQ.data?.routes ?? []
  const routingMode =
    (routesQ.data?.metadata?.routing_mode_used as string | undefined) ?? summaryQ.data?.routing_mode ?? null

  const dailyPlan = useMemo(() => normalizeMasterPlan(dailyQ.data?.data, 'generated'), [dailyQ.data])
  const pendingPlan = useMemo(() => normalizeMasterPlan(pendingQ.data?.data, 'pending'), [pendingQ.data])
  const approvedPlan = useMemo(() => normalizeMasterPlan(approvedQ.data?.data, 'approved'), [approvedQ.data])

  const planStatus = summaryQ.data?.plan_status
    ?? (approvedPlan ? 'approved' : pendingPlan ? 'pending' : dailyPlan ? 'generated' : 'unknown')

  const activePlan = approvedPlan ?? pendingPlan ?? dailyPlan
  const notifications = notifQ.data ?? []

  const lastRunRaw =
    (agentQ.data?.data?.last_run_timestamp as string | undefined) ??
    (agentQ.data?.data?.last_run_id as string | undefined) ??
    summaryQ.data?.last_run_id ??
    null
  const lastRunLabel = lastRunRaw && lastRunRaw.includes('T') ? formatRelativeTime(lastRunRaw) : lastRunRaw ?? '—'

  const uniqueStations = new Set(routes.map((r) => String(r.assigned_station ?? r.route_id))).size
  const stationsCovered = summaryQ.data?.total_stations || uniqueStations

  const kpis = [
    { label: 'Route groups', value: String(routes.length), icon: RouteIcon, tone: 'route' as const },
    { label: 'Stations covered', value: String(stationsCovered), icon: MapPin, tone: 'cyan' as const },
    { label: 'Today’s assignments', value: String(activePlan?.totalAssignments ?? summaryQ.data?.total_assignments ?? 0), icon: CheckSquare, tone: 'cyan' as const },
    { label: 'Pending approvals', value: planStatus === 'pending' || planStatus === 'generated' ? '1' : '0', icon: Clock, tone: 'amber' as const },
    { label: 'Dry-run notifications', value: String(notifications.length), icon: Bell, tone: 'cyan' as const },
    { label: 'Routing mode', value: routingMode ? String(routingMode) : '—', icon: Gauge, tone: 'route' as const },
  ]

  return (
    <PageScaffold
      eyebrow="Patrol Operations"
      title="Station-wise Patrol Planning"
      description="Convert ROI-ranked hotspots into M10 patrol routes, head-officer approval, and dry-run dispatch instructions."
      actions={
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <StatusChip label="Plan status" value={planStatus} tone={planStatus === 'pending' ? 'amber' : planStatus === 'approved' ? 'cleared' : 'cyan'} />
          <StatusChip label="Routes" value={`${routes.length} ready`} tone="cyan" />
          <StatusChip label="Dispatch" value="Dry-run" tone="cyan" />
          <StatusChip label="Last run" value={lastRunLabel} tone="muted" />
        </div>
      }
    >
      {/* KPI row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <motion.div
              key={k.label}
              variants={fadeUp}
              className="rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-3.5 backdrop-blur-xl"
            >
              <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-civic-ivory/45">
                <Icon className={cn('h-3 w-3', k.tone === 'route' ? 'text-status-route' : k.tone === 'amber' ? 'text-status-amber' : 'text-btp-cyan')} />
                {k.label}
              </p>
              <p className="mt-1.5 truncate text-xl font-bold capitalize text-civic-white">{k.value}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* workflow strip */}
      <OperationsWorkflowStrip status={planStatus} className="mb-6" />

      <ModuleTabs
        defaultTab="routes"
        layoutId="operations-tab"
        tabs={[
          {
            id: 'routes',
            label: 'Route Planner',
            content: routesQ.isLoading ? (
              <LoadingSkeleton lines={6} />
            ) : (
              <RoutePlannerPanel routes={routes} routingModeFallback={routingMode} />
            ),
          },
          {
            id: 'plan',
            label: 'Master Plan',
            content: (
              <MasterPlanInbox
                daily={dailyPlan}
                pending={pendingPlan}
                approved={approvedPlan}
                isLoading={dailyQ.isLoading && pendingQ.isLoading && approvedQ.isLoading}
              />
            ),
          },
          {
            id: 'approval',
            label: 'Approval',
            testId: 'approval-tab',
            content: (
              <ApprovalConsole
                status={planStatus}
                dailyPlan={dailyPlan}
                pendingPlan={pendingPlan}
                approvedPlan={approvedPlan}
              />
            ),
          },
          {
            id: 'dispatch',
            label: 'Dispatch Preview',
            testId: 'dispatch-preview-tab',
            content: (
              <DispatchPreview
                notifications={notifications}
                notifLoading={notifQ.isLoading}
                planStatus={planStatus}
              />
            ),
          },
        ]}
      />
    </PageScaffold>
  )
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'cyan' | 'cleared' | 'muted'
}) {
  const toneClass = {
    amber: 'border-status-amber/30 bg-status-amber/12 text-status-amber',
    cyan: 'border-btp-cyan/25 bg-btp-cyan/10 text-btp-cyan',
    cleared: 'border-status-cleared/30 bg-status-cleared/12 text-status-cleared',
    muted: 'border-civic-white/12 bg-civic-white/5 text-civic-ivory/65',
  }[tone]
  return (
    <div className={cn('rounded-xl border px-3 py-1.5 backdrop-blur-xl', toneClass)}>
      <p className="text-[8px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xs font-bold capitalize">{value}</p>
    </div>
  )
}
