import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { GlassCard } from '@/components/ui/GlassCard'

const classificationData = [
  { name: 'Structural', value: 42, color: '#D62828' },
  { name: 'Responsive', value: 38, color: '#22D3EE' },
  { name: 'Seasonal', value: 20, color: '#7C3AED' },
]

export function ClassificationDonut() {
  return (
    <GlassCard>
      <p className="mb-4 text-sm font-medium text-slate-700">
        Hotspot Classification
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={classificationData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            dataKey="value"
            paddingAngle={2}
          >
            {classificationData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
