'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { AnalyticsResponse } from '@/app/api/errors/analytics/route'
import { HeatmapPanel } from '@/components/heatmap-panel'
import { VitalsPanel } from '@/components/vitals-panel'
import { TopErrorsPanel } from '@/components/top-errors-panel'

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
      <div className="space-y-3">
        <div className="rounded-md border border-border p-6 animate-pulse bg-muted/30 h-48" />
        <div className="rounded-md border border-border p-4 animate-pulse bg-muted/30 h-10" />
        <div className="rounded-md border border-border p-6 animate-pulse bg-muted/30 h-48" />
      </div>
    )
  }

  if (!data) return null

  const { timeline, totals, topBrowsers, heatmap, hasFullVitals, vitalSummaries, pageVitals, topErrors } = data

  // Only show ticks for the first, middle, and last data points to avoid crowding
  const tickIndices = new Set([0, Math.floor(timeline.length / 2), timeline.length - 1])
  const chartData = timeline.map((d, i) => ({
    ...d,
    label: tickIndices.has(i) ? fmt(d.day) : '',
  }))

  const maxVal = Math.max(...timeline.map((d) => d.total), 1)

  return (
    <div className="space-y-4">
      {/* ── Bad web vitals per page ─────────────────────────────────────── */}
      <VitalsPanel hasFullVitals={hasFullVitals} vitalSummaries={vitalSummaries} pageVitals={pageVitals} />

      {/* ── Timeline chart ───────────────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs font-medium text-muted-foreground">Events over last {days} days</p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold">{totals.total.toLocaleString()} total</span>
            {(['error', 'network', 'vital'] as const).filter(k => totals[k] > 0).map(k => (
              <span key={k} className="text-xs font-mono" style={{ color: EVENT_COLORS[k] }}>
                {totals[k].toLocaleString()} {EVENT_LABELS[k].toLowerCase()}
              </span>
            ))}
          </div>
        </div>
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

      {/* ── Top errors by fingerprint ────────────────────────────────────── */}
      <TopErrorsPanel errors={topErrors} projectId={projectId} />

      {/* ── Heatmap + top browsers ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-3">
        <HeatmapPanel cells={heatmap} />

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
