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

const roiData = [
  { station: 'Adugodi', roi: 71.8, violations: 312 },
  { station: 'Indiranagar', roi: 68.2, violations: 245 },
  { station: 'Koramangala', roi: 65.4, violations: 198 },
  { station: 'HSR', roi: 72.5, violations: 156 },
]

export function RoiComparisonChart() {
  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">
        ROI vs Violation Count by Station
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={roiData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,75,140,0.08)" />
          <XAxis dataKey="station" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="roi" fill="#0B3A6F" radius={[4, 4, 0, 0]} />
          <Bar dataKey="violations" fill="#22D3EE" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
