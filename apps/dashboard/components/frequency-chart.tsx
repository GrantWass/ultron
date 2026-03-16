'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface FrequencyChartProps {
  data: { day: string; count: number }[]
}

export function FrequencyChart({ data }: FrequencyChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        No frequency data available
      </div>
    )
  }

  const formatted = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            background: 'hsl(var(--background))',
          }}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
