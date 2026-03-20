'use client'

import type { PageVitalBad } from '@/app/api/errors/analytics/route'
import { Info } from 'lucide-react'

const VITAL_PILL: Record<string, string> = {
  poor:               'bg-red-100    text-red-700    dark:bg-red-950/40    dark:text-red-400',
  'needs-improvement':'bg-amber-100  text-amber-700  dark:bg-amber-950/40  dark:text-amber-400',
}

interface VitalsPanelProps {
  pageVitals: PageVitalBad[]
}

export function VitalsPanel({ pageVitals }: VitalsPanelProps) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 space-y-3">
      {/* Header with reportAllVitals tip */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium text-muted-foreground">
          Bad web vitals per page
        </p>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Info className="h-3 w-3 shrink-0" />
          Enable{' '}
          <code className="font-mono">reportAllVitals: true</code>
          {' '}for full distribution
        </p>
      </div>

      {/* Per-page list */}
      {pageVitals.length === 0 ? (
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
                  <span
                    key={v.name}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${VITAL_PILL[v.hasPoor ? 'poor' : 'needs-improvement']}`}
                    title={`${v.name}: ${v.count} ${v.hasPoor ? 'poor' : 'needs-improvement'} reading${v.count !== 1 ? 's' : ''}`}
                  >
                    {v.name} ×{v.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
