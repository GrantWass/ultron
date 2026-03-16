import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { FixSuggestion } from '@/components/fix-suggestion'
import { EventTypeBadge, CategoryBadge, VitalRatingBadge } from '@/components/event-badge'
import type { ErrorRecord } from '@ultron/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ── Metadata helpers ──────────────────────────────────────────────────────────

function NetworkDetail({ meta }: { meta: Record<string, unknown> }) {
  const timing = meta.timing as Record<string, number> | null
  return (
    <div className="space-y-4">
      {/* Request summary */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
          <h2 className="text-sm font-medium">Request</h2>
          {typeof meta.category === 'string' && <CategoryBadge category={meta.category} />}
        </div>
        <div className="divide-y divide-border">
          {[
            ['Method',   meta.method],
            ['URL',      meta.request_url],
            ['Status',   meta.status ? `${meta.status}${meta.status_text ? ` ${meta.status_text}` : ''}` : '—'],
            ['Duration', meta.duration != null ? `${meta.duration}ms` : '—'],
            ['Page',     meta.page],
            ['Referrer', meta.referrer ?? '—'],
          ].map(([label, value]) => value != null ? (
            <div key={String(label)} className="px-4 py-2 flex gap-4 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{String(label)}</span>
              <span className="font-mono text-xs break-all">{String(value)}</span>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Query params */}
      {meta.params != null && Object.keys(meta.params as object).length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Query Params</h2>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(meta.params as Record<string, string>).map(([k, v]) => (
              <div key={k} className="px-4 py-2 flex gap-4 text-sm">
                <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">{k}</span>
                <span className="font-mono text-xs break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timing breakdown */}
      {timing != null && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Timing Breakdown</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-4">
            {[
              ['DNS',      timing.dns],
              ['TCP',      timing.tcp],
              ['TLS',      timing.tls],
              ['TTFB',     timing.ttfb],
              ['Transfer', timing.transfer],
              ['Total',    timing.total],
            ].map(([label, ms]) => (
              <div key={String(label)} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">{String(label)}</span>
                <span className="font-mono text-sm font-medium">{String(ms)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response body */}
      {meta.response_body != null && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Response Body <span className="text-muted-foreground font-normal">(first 500 chars)</span></h2>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-foreground/80">
            {String(meta.response_body)}
          </pre>
        </div>
      )}
    </div>
  )
}

function VitalDetail({ meta }: { meta: Record<string, unknown> }) {
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000],
    CLS:  [0.1,  0.25],
    INP:  [200,  500],
    FCP:  [1800, 3000],
    TTFB: [800,  1800],
  }
  const name = String(meta.name ?? '')
  const value = meta.value as number
  const rating = String(meta.rating ?? '')
  const [good, poor] = thresholds[name] ?? [0, 0]
  const unit = name === 'CLS' ? '' : 'ms'
  const displayValue = name === 'CLS' ? value?.toFixed(3) : Math.round(value)

  const contextRows = [
    meta.navigationType != null && ['Navigation',  String(meta.navigationType)],
    meta.ttfb         != null && ['TTFB',         `${meta.ttfb}ms`],
    meta.redirectCount  != null && Number(meta.redirectCount) > 0 && ['Redirects', String(meta.redirectCount)],
    meta.element      != null && ['LCP Element',  String(meta.element)],
    meta.url          != null && ['Resource URL', String(meta.url)],
    meta.loadTime     != null && ['Load Time',    `${meta.loadTime}ms`],
    meta.renderTime   != null && ['Render Time',  `${meta.renderTime}ms`],
    meta.size         != null && ['Element Size', `${meta.size}px²`],
  ].filter(Boolean) as [string, string][]

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
        <h2 className="text-sm font-medium">Web Vital — {name}</h2>
        <VitalRatingBadge rating={rating} />
      </div>
      <div className="p-6 flex flex-col items-center gap-3">
        <span className="text-4xl font-mono font-bold">
          {displayValue}{unit}
        </span>
        <div className="text-xs text-muted-foreground text-center">
          <span className="text-green-600">Good &lt; {name === 'CLS' ? good : `${good}ms`}</span>
          {' · '}
          <span className="text-red-600">Poor &gt; {name === 'CLS' ? poor : `${poor}ms`}</span>
        </div>
      </div>
      {contextRows.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {contextRows.map(([label, val]) => (
            <div key={label} className="px-4 py-2 flex gap-4 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
              <span className="font-mono text-xs break-all">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResourceDetail({ meta }: { meta: Record<string, unknown> }) {
  const src = String(meta.src ?? meta.href ?? '—')
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50">
        <h2 className="text-sm font-medium">Failed Resource</h2>
      </div>
      <div className="divide-y divide-border">
        {[
          ['Tag',  meta.tagName ?? meta.tag],
          ['URL',  src],
          ['Page', meta.page],
        ].map(([label, value]) => value != null ? (
          <div key={String(label)} className="px-4 py-2 flex gap-4 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">{String(label)}</span>
            <span className="font-mono text-xs break-all">{String(value)}</span>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: error } = await supabase
    .from('errors')
    .select(`*, projects!inner(id, user_id, name)`)
    .eq('id', id)
    .eq('projects.user_id', user.id)
    .single()

  if (!error) notFound()

  const err = error as ErrorRecord & { projects: { id: string; name: string } }
  const meta = (err.metadata ?? {}) as Record<string, unknown>
  const eventType = err.event_type ?? 'error'

  const { data: suggestion } = await supabase
    .from('fix_suggestions')
    .select('suggestion')
    .eq('error_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/dashboard/projects/${err.project_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {(error as any).projects?.name ?? 'project'}
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <EventTypeBadge type={eventType as any} />
          <h1 className="font-mono text-lg font-semibold break-all leading-snug">
            {err.message}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {err.browser && <span>Browser: {err.browser}</span>}
          {err.os && <span>OS: {err.os}</span>}
          {err.viewport && <span>Viewport: {err.viewport}</span>}
          {err.connection && <span>Connection: {err.connection}</span>}
          {err.session_id && <span>Session: {err.session_id}</span>}
          <span>{formatDate(err.created_at)}</span>
        </div>
      </div>

      {/* Event-type-specific detail sections */}
      {eventType === 'network' && <NetworkDetail meta={meta} />}
      {eventType === 'vital' && <VitalDetail meta={meta} />}
      {eventType === 'resource_error' && <ResourceDetail meta={meta} />}

      {/* Stack trace — shown for JS errors and as fallback */}
      {err.stack_trace && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Stack Trace</h2>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed text-foreground/80">
            {err.stack_trace}
          </pre>
        </div>
      )}

      {/* Raw metadata (for network, vitals — shows extra fields not displayed above) */}
      {eventType !== 'error' && Object.keys(meta).length > 0 && (
        <details className="rounded-md border border-border overflow-hidden">
          <summary className="px-4 py-2 cursor-pointer text-sm font-medium bg-muted/50 hover:bg-muted transition-colors select-none">
            Raw Metadata
          </summary>
          <pre className="p-4 text-xs font-mono overflow-x-auto">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </details>
      )}

      {/* AI fix suggestion — only for JS errors */}
      {eventType === 'error' && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">AI Fix Suggestion</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect GitHub to fetch source files for better suggestions.
            </p>
          </div>
          <div className="p-4">
            <FixSuggestion
              errorId={id}
              existingSuggestion={suggestion?.suggestion ?? null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
