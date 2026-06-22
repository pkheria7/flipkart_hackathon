import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard } from '@/components/ui/GlassCard'

const weekData = [
  { metric: 'Avg ROI', week1: 68.4, week2: 74.2 },
  { metric: 'Structural', week1: 312, week2: 298 },
  { metric: 'LCLE %', week1: 22.1, week2: 28.6 },
  { metric: 'Coverage %', week1: 78.5, week2: 86.3 },
]

export function WeekComparisonChart() {
  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">
        Week 1 vs Week 2 Comparison
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={weekData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,75,140,0.08)" />
          <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="week1" name="Week 1" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="week2" name="Week 2" fill="#0B3A6F" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
