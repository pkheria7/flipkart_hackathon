import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { getReports } from '@/services/reportService'
import { GlassCard } from '@/components/ui/GlassCard'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function ReportsPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: getReports,
  })

  return (
    <PageScaffold
      eyebrow="System"
      title="Reports + PDF Briefs"
      description="Pipeline reports, escalation PDFs, and demo briefs"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <GlassCard key={report.id}>
            <FileText className="mb-2 h-5 w-5 text-btp-blue" />
            <p className="font-medium text-slate-800">{report.title}</p>
            <p className="mt-1 text-xs text-slate-400">{report.type.toUpperCase()}</p>
            <p className="mt-2 text-sm text-slate-500">{report.description}</p>
          </GlassCard>
        ))}
      </div>
    </PageScaffold>
  )
}
