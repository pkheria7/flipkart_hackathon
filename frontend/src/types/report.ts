export interface ReportItem {
  id: string
  title: string
  type: 'markdown' | 'pdf' | 'csv'
  path: string
  generated_at: string
  description: string
}

export interface WeekComparisonMetric {
  label: string
  week_1: number
  week_2: number
  unit?: string
}

export interface WeekComparison {
  disclaimer: string
  week_1_label: string
  week_2_label: string
  metrics: WeekComparisonMetric[]
  structural_shift_pct: number
  feedback_loop_active: boolean
}
