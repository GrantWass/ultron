'use client'

import type { VitalSummary } from '@/app/api/errors/analytics/route'

const RATING_PILL: Record<string, string> = {
  'needs-improvement': 'border-amber-200 bg-amber-50  dark:border-amber-800 dark:bg-amber-950/30',
  poor:                'border-red-200   bg-red-50    dark:border-red-800   dark:bg-red-950/30',
}

const RATING_VALUE: Record<string, string> = {
  'needs-improvement': 'text-amber-700 dark:text-amber-400',
  poor:                'text-red-700   dark:text-red-400',
}

const RATING_DOT: Record<string, string> = {
  'needs-improvement': 'bg-amber-500',
  poor:                'bg-red-500',
}

function fmt(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}

interface VitalsPanelProps {
  vitals: VitalSummary[]
}

export function VitalsPanel({ vitals }: VitalsPanelProps) {
  if (vitals.length === 0) return null

  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-xs font-medium text-muted-foreground">Web vitals · bad readings only</p>
        <p className="text-[10px] text-muted-foreground">
          enable <code className="font-mono">reportAllVitals</code> for full distribution
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {vitals.map((v) => {
          const poorPct = v.total > 0 ? Math.round((v.poor / v.total) * 100) : 0
          return (
            <div
              key={v.name}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${RATING_PILL[v.rating]}`}
              title={`${v.name} — ${v.total} bad readings reported\n${v.needsImprovement} needs-improvement · ${v.poor} poor (${poorPct}%)\nmedian of bad samples: ${fmt(v.name, v.medianBad)}\n\nNote: only non-good readings are reported by default.\nEnable reportAllVitals for a true percentile.`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${RATING_DOT[v.rating]}`} />
              <span className="font-medium text-foreground">{v.name}</span>
              <span className={`font-mono font-semibold tabular-nums ${RATING_VALUE[v.rating]}`}>
                {fmt(v.name, v.medianBad)}
              </span>
              <span className="text-muted-foreground">
                {v.total} bad
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
