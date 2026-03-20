'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ExternalLink, ArrowRight } from 'lucide-react'
import type { TopError } from '@/app/api/errors/analytics/route'

const TYPE_BADGE: Record<string, string> = {
  error:          'bg-red-100    text-red-700    dark:bg-red-950/40    dark:text-red-400',
  network:        'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  resource_error: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
}

const TYPE_LABEL: Record<string, string> = {
  error:          'JS Error',
  network:        'Network',
  resource_error: 'Resource',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TopErrorsPanelProps {
  errors: TopError[]
  projectId: string
}

export function TopErrorsPanel({ errors, projectId }: TopErrorsPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  if (errors.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Top errors by frequency</p>
        <p className="text-sm text-muted-foreground">No errors in this period.</p>
      </div>
    )
  }

  const maxCount = errors[0].count

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Top errors by frequency</p>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Browse all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {errors.map((err, i) => {
          const isOpen = expanded.has(i)
          const pct = Math.round((err.count / maxCount) * 100)

          return (
            <div key={err.fingerprint}>
              {/* ── Collapsed row ── */}
              <button
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors group"
                onClick={() => toggle(i)}
              >
                {/* Rank badge */}
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Message + type badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[err.event_type] ?? 'bg-muted text-muted-foreground'}`}>
                      {TYPE_LABEL[err.event_type] ?? err.event_type}
                    </span>
                    <span className="text-sm font-mono text-foreground truncate leading-snug" title={err.message}>
                      {err.message}
                    </span>
                  </div>

                  {/* Frequency bar + timestamps */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden max-w-[160px]">
                      <div
                        className="h-full rounded-full bg-primary/50"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      first {relativeTime(err.first_seen)} · last {relativeTime(err.last_seen)}
                    </span>
                  </div>
                </div>

                {/* Count + chevron */}
                <div className="shrink-0 flex items-center gap-1.5 ml-2 mt-0.5">
                  <span className="text-sm font-semibold tabular-nums">{err.count.toLocaleString()}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'}`}
                  />
                </div>
              </button>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div className="bg-muted/20 border-t border-border/60 px-4 py-3 pl-12 space-y-3">
                  {/* Full message */}
                  <p className="text-xs font-mono text-foreground bg-card border border-border rounded px-3 py-2 break-all leading-relaxed">
                    {err.message}
                  </p>

                  {/* Scope summary */}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      <span className="font-semibold text-foreground tabular-nums">{err.count.toLocaleString()}</span>
                      {' '}occurrence{err.count !== 1 ? 's' : ''} in this window
                    </p>
                    <p>
                      First seen {relativeTime(err.first_seen)}
                      {' · '}
                      Most recent {relativeTime(err.last_seen)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 pt-0.5">
                    <Link
                      href={`/dashboard/errors/${err.sample_id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View most recent instance
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/dashboard/projects/${projectId}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Browse error feed →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
