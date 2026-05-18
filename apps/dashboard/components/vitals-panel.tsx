'use client'

import type { PageVitalBad, VitalSummary } from '@/app/api/errors/analytics/route'
import { Info } from 'lucide-react'
import { Tooltip } from '@/components/tip'

const RATING_PILL: Record<string, string> = {
  good:               'bg-green-100  text-green-700  dark:bg-green-950/40  dark:text-green-400',
  'needs-improvement':'bg-amber-100  text-amber-700  dark:bg-amber-950/40  dark:text-amber-400',
  poor:               'bg-red-100    text-red-700    dark:bg-red-950/40    dark:text-red-400',
}

const VITAL_INFO: Record<string, string> = {
  LCP:  'Largest Contentful Paint — how fast the main content loads. Good: ≤2.5 s, Needs improvement: ≤4 s',
  FID:  'First Input Delay — how quickly the page responds to the first interaction. Good: ≤100 ms, Needs improvement: ≤300 ms',
  CLS:  'Cumulative Layout Shift — how stable the layout is while loading. Good: ≤0.1, Needs improvement: ≤0.25',
  FCP:  'First Contentful Paint — time until any content first appears on screen. Good: ≤1.8 s',
  INP:  'Interaction to Next Paint — overall responsiveness to clicks and taps. Good: ≤200 ms, Needs improvement: ≤500 ms',
  TTFB: 'Time to First Byte — how fast the server starts responding. Good: ≤800 ms',
}

function fmtVital(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
}

interface VitalsPanelProps {
  hasFullVitals: boolean
  vitalSummaries: VitalSummary[]
  pageVitals: PageVitalBad[]
}

export function VitalsPanel({ hasFullVitals, vitalSummaries, pageVitals }: VitalsPanelProps) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium text-muted-foreground">
          {hasFullVitals ? 'Web vitals — p75' : 'Bad web vitals per page'}
        </p>
        {!hasFullVitals && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Info className="h-3 w-3 shrink-0" />
            Enable <code className="font-mono">reportAllVitals: true</code> for p75 distribution
          </p>
        )}
      </div>

      {hasFullVitals ? (
        /* ── p75 summary (full distribution available) ─────────────────── */
        vitalSummaries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No vital readings in this period.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vitalSummaries.map((v) => (
              <div key={v.name} className="flex items-center gap-1.5">
                <Tooltip text={VITAL_INFO[v.name] ?? v.name}>
                  <span className="text-[10px] font-medium text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help">
                    {v.name}
                  </span>
                </Tooltip>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${RATING_PILL[v.rating]}`}
                  title={`p75 across ${v.total} readings`}
                >
                  {fmtVital(v.name, v.p75)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Per-page bad readings (biased sample only) ─────────────────── */
        pageVitals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bad vital readings in this period.</p>
        ) : (
          <div className="space-y-2">
            {pageVitals.map((page) => (
              <div key={page.url} className="flex items-center gap-2 min-w-0">
                <span
                  className="flex-1 truncate text-xs font-mono text-foreground min-w-0"
                  title={page.url}
                >
                  {page.url}
                </span>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {page.vitals.map((v) => (
                    <Tooltip
                      key={v.name}
                      text={`${VITAL_INFO[v.name] ?? v.name} — ${v.count} ${v.hasPoor ? 'poor' : 'needs-improvement'} reading${v.count !== 1 ? 's' : ''} on this page`}
                    >
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums cursor-help ${RATING_PILL[v.hasPoor ? 'poor' : 'needs-improvement']}`}
                      >
                        {v.name} ×{v.count}
                      </span>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
