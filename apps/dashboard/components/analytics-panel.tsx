'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { AnalyticsResponse } from '@/app/api/errors/analytics/route'

const EVENT_COLORS = {
  error:          '#ef4444',
  network:        '#f97316',
  vital:          '#3b82f6',
  resource_error: '#eab308',
} as const

const EVENT_LABELS = {
  error:          'JS Error',
  network:        'Network',
  vital:          'Web Vital',
  resource_error: 'Resource',
} as const

interface StatCardProps {
  label: string
  value: number
  color?: string
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold font-mono" style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </span>
    </div>
  )
}

function fmt(day: string) {
  const d = new Date(day + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface AnalyticsPanelProps {
  projectId: string
  days?: number
}

export function AnalyticsPanel({ projectId, days = 30 }: AnalyticsPanelProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/errors/analytics?project_id=${projectId}&days=${days}`)
      .then((r) => r.json())
      .then((d: AnalyticsResponse) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId, days])

  if (loading) {
    return (
      <div className="rounded-md border border-border p-6 animate-pulse bg-muted/30 h-48" />
    )
  }

  if (!data) return null

  const { timeline, totals, topBrowsers } = data

  // Only show ticks for the first, middle, and last data points to avoid crowding
  const tickIndices = new Set([0, Math.floor(timeline.length / 2), timeline.length - 1])
  const chartData = timeline.map((d, i) => ({
    ...d,
    label: tickIndices.has(i) ? fmt(d.day) : '',
  }))

  const maxVal = Math.max(...timeline.map((d) => d.total), 1)

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total events" value={totals.total} />
        <StatCard label="JS Errors"    value={totals.error}          color={EVENT_COLORS.error} />
        <StatCard label="Network"      value={totals.network}        color={EVENT_COLORS.network} />
        <StatCard label="Vitals"       value={totals.vital}          color={EVENT_COLORS.vital} />
      </div>

      {/* Timeline chart + top browsers */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-3">
        {/* Stacked bar chart */}
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Events over last {days} days
          </p>
          {totals.total === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
              No events in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }} barSize={maxVal > 100 ? 4 : 8}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
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
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload as { day?: string } | undefined
                    return d?.day ? fmt(d.day) : ''
                  }}
                  formatter={(value: number, name: string) => [
                    value,
                    EVENT_LABELS[name as keyof typeof EVENT_LABELS] ?? name,
                  ]}
                />
                <Legend
                  iconType="square"
                  iconSize={8}
                  formatter={(name) => (
                    <span style={{ fontSize: 11 }}>
                      {EVENT_LABELS[name as keyof typeof EVENT_LABELS] ?? name}
                    </span>
                  )}
                />
                {(Object.keys(EVENT_COLORS) as Array<keyof typeof EVENT_COLORS>).map((et, i, arr) => (
                  <Bar
                    key={et}
                    dataKey={et}
                    stackId="a"
                    fill={EVENT_COLORS[et]}
                    radius={i === arr.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top browsers */}
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Top browsers</p>
          {topBrowsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2.5">
              {topBrowsers.map(({ browser, count }) => {
                const pct = totals.total > 0 ? Math.round((count / totals.total) * 100) : 0
                return (
                  <div key={browser} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="truncate text-foreground max-w-[120px]" title={browser}>{browser}</span>
                      <span className="text-muted-foreground ml-2 shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
