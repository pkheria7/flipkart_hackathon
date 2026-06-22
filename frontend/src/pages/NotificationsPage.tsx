import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '@/services/notificationService'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function NotificationsPage() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(20),
  })

  return (
    <PageScaffold
      eyebrow="Operations"
      title="Dispatch Preview"
      description="Officer and tow truck email notifications before send — Phase 5"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notifications.map((n) => (
          <GlassCard key={n.id} className="space-y-2">
            <p className="text-sm font-medium text-slate-800">{n.subject}</p>
            <p className="text-xs text-slate-500">To: {n.recipient}</p>
            <p className="text-xs text-slate-400 line-clamp-2">{n.body.slice(0, 160)}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="mt-4">
        <p className="text-sm text-slate-500">
          EML preview, Kannada translations, and dispatch audit trail.
        </p>
      </GlassCard>
    </PageScaffold>
  )
}
