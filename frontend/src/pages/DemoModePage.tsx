import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckSquare,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Route,
  TrendingUp,
} from 'lucide-react'
import { PageScaffold } from '@/components/ui/PageScaffold'
import { fadeUp, staggerContainer, viewportOnce } from '@/lib/motion'

const demoSteps = [
  { step: 1, label: 'Command Center', path: '/command', icon: LayoutDashboard, desc: 'Operational KPIs and the hotspot command map.' },
  { step: 2, label: 'Hotspot Intelligence', path: '/intelligence', icon: BarChart3, desc: 'Priority board ranks impact, not raw challans.' },
  { step: 3, label: 'Hotspot Detail', path: '/hotspots/C_446', icon: MapPin, desc: 'Drill into LCLE, BCI and ROI for one cluster.' },
  { step: 4, label: 'Patrol Route', path: '/operations', icon: Route, desc: 'OSM graph VRP routes per station.' },
  { step: 5, label: 'Master Plan Approval', path: '/operations', icon: CheckSquare, desc: '4 AM generated plan, human-in-loop review.' },
  { step: 6, label: 'Dispatch Preview', path: '/operations', icon: Bell, desc: 'Dry-run officer and tow notifications.' },
  { step: 7, label: 'Feedback Loop', path: '/feedback-escalation', icon: MessageSquare, desc: 'Structural boost from recurrence signals.' },
  { step: 8, label: 'Escalation Brief', path: '/feedback-escalation', icon: FileText, desc: 'BBMP/BTP infrastructure escalation brief.' },
  { step: 9, label: 'Impact Evidence', path: '/impact', icon: TrendingUp, desc: 'Week comparison and backend validation.' },
]

export function DemoModePage() {
  return (
    <PageScaffold
      eyebrow="Guided Demo"
      title="Demo Mode"
      description="A guided, presentation-ready walkthrough of the traffic-impact intelligence workflow."
    >
      <div className="mb-8 command-panel">
        <div className="aurora-bg opacity-50" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-btp-cyan">9-step presentation flow</p>
            <p className="mt-1 max-w-xl text-sm text-civic-ivory/75">
              Follow each step to see how GridLock Command converts FTVR records into ROI-ranked
              enforcement, human-in-loop approval, and feedback-aware structural escalation.
            </p>
          </div>
          <Link to="/command">
            <span className="inline-flex items-center gap-2 rounded-xl bg-btp-cyan px-4 py-2 text-sm font-semibold text-civic-navy shadow-glow-cyan transition-transform hover:-translate-y-0.5">
              Begin walkthrough
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>

      <motion.ol
        className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
      >
        {demoSteps.map((s) => (
          <motion.li key={s.step} variants={fadeUp}>
            <Link
              to={s.path}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-btp-cyan/12 bg-civic-navy/55 p-5 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-btp-cyan/40 hover:shadow-glow-cyan"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl font-bold text-btp-cyan/30 transition-colors group-hover:text-btp-cyan/60">
                  {String(s.step).padStart(2, '0')}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-btp-cyan/10 text-btp-cyan transition-colors group-hover:bg-btp-cyan group-hover:text-civic-navy">
                  <s.icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 font-bold text-civic-white">{s.label}</p>
              <p className="mt-1.5 flex-1 text-sm text-civic-ivory/60">{s.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-btp-cyan">
                Go to step
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.li>
        ))}
      </motion.ol>
    </PageScaffold>
  )
}
