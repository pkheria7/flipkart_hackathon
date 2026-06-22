import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard } from '@/components/ui/GlassCard'

const hourlyData = [
  { hour: '02-04', violations: 142 },
  { hour: '08-10', violations: 98 },
  { hour: '11-13', violations: 156 },
  { hour: '14-16', violations: 201 },
  { hour: '17-19', violations: 178 },
  { hour: '20-22', violations: 87 },
]

export function HourlyPatternChart() {
  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">
        Hourly Violation Pattern
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={hourlyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,75,140,0.08)" />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="violations" fill="#0B3A6F" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
