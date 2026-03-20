import { notFound, redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { FixSuggestion } from '@/components/fix-suggestion'
import { EventTypeBadge, CategoryBadge, VitalRatingBadge } from '@/components/event-badge'
import { ResolveButton } from '@/components/resolve-button'
import type { ErrorWithProject } from '@ultron/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Tip } from '@/components/tip'
import { SessionReplayPlayer } from '@/components/session-replay-player'

// ── Metadata helpers ──────────────────────────────────────────────────────────

const CATEGORY_TIPS: Record<string, string> = {
  cors:            'Cross-Origin Resource Sharing blocked. The server didn\'t return the required Access-Control headers, so the browser refused the response. Usually fixed by adding "Access-Control-Allow-Origin" to the server response.',
  server_error:    'The server returned a 5xx status code, indicating an internal error on the server side (not the client).',
  client_error:    'The server returned a 4xx status code — e.g. 401 Unauthorized, 403 Forbidden, 404 Not Found. Usually a problem with the request itself.',
  slow:            'The request completed successfully but took longer than your configured slow-request threshold.',
  network_failure: 'The request never received a response — the connection was refused, timed out, or the device went offline.',
}

const TIMING_TIPS: Record<string, string> = {
  DNS:      'DNS lookup — time to resolve the hostname to an IP address.',
  TCP:      'TCP handshake — time to establish the TCP connection.',
  TLS:      'TLS handshake — time to negotiate the secure HTTPS connection.',
  TTFB:     'Time to First Byte — time from sending the request until receiving the first byte of the response. Reflects server processing time.',
  Transfer: 'Time to download the response body after the first byte arrived.',
  Total:    'Total round-trip time from request start to response end.',
}

function DurationChip({ ms }: { ms: number }) {
  const color = ms >= 3000 ? 'text-red-600 bg-red-50 border-red-200'
              : ms >= 1000 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
              : 'text-green-600 bg-green-50 border-green-200'
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${color}`}>{ms}ms</span>
  )
}

function NetworkDetail({ meta }: { meta: Record<string, unknown> }) {
  const timing = meta.timing as Record<string, number> | null
  const category = typeof meta.category === 'string' ? meta.category : null
  const status = meta.status as number | null
  const duration = meta.duration as number | null

  const statusDisplay = status
    ? `${status}${meta.status_text ? ` ${meta.status_text}` : ''}`
    : 'No response received'

  return (
    <div className="space-y-4">
      {/* Request summary */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
          <h2 className="text-sm font-medium">Request</h2>
          {category && (
            <div className="flex items-center gap-1.5">
              <CategoryBadge category={category} />
              {CATEGORY_TIPS[category] && <Tip text={CATEGORY_TIPS[category]} />}
            </div>
          )}
        </div>
        <div className="divide-y divide-border">
          {/* Method */}
          {!!meta.method && (
            <div className="px-4 py-2 flex gap-4 text-sm items-center">
              <span className="w-24 shrink-0 text-muted-foreground">Method</span>
              <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded border ${
                meta.method === 'GET'    ? 'text-green-700 bg-green-50 border-green-200'
                : meta.method === 'POST'   ? 'text-blue-700 bg-blue-50 border-blue-200'
                : meta.method === 'DELETE' ? 'text-red-700 bg-red-50 border-red-200'
                : meta.method === 'PUT' || meta.method === 'PATCH' ? 'text-orange-700 bg-orange-50 border-orange-200'
                : 'text-muted-foreground bg-muted border-border'
              }`}>{String(meta.method)}</span>
            </div>
          )}
          {/* URL */}
          {!!meta.request_url && (
            <div className="px-4 py-2 flex gap-4 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">URL</span>
              <span className="font-mono text-xs break-all">{String(meta.request_url)}</span>
            </div>
          )}
          {/* Status */}
          <div className="px-4 py-2 flex gap-4 text-sm items-center">
            <span className="w-24 shrink-0 text-muted-foreground">Status</span>
            <span className={`font-mono text-xs ${!status ? 'text-muted-foreground italic' : ''}`}>
              {statusDisplay}
            </span>
            {!status && <Tip text="Status 0 means no HTTP response was received — the connection failed before the server could reply." />}
          </div>
          {/* Duration */}
          {duration != null && (
            <div className="px-4 py-2 flex gap-4 text-sm items-center">
              <span className="w-24 shrink-0 text-muted-foreground">Duration</span>
              <DurationChip ms={duration} />
            </div>
          )}
          {/* Page */}
          {!!meta.page && (
            <div className="px-4 py-2 flex gap-4 text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">Page</span>
              <span className="font-mono text-xs break-all">{String(meta.page)}</span>
            </div>
          )}
          {/* Referrer */}
          <div className="px-4 py-2 flex gap-4 text-sm items-center">
            <span className="w-24 shrink-0 text-muted-foreground">Referrer</span>
            <span className="font-mono text-xs break-all text-muted-foreground">{meta.referrer ? String(meta.referrer) : '—'}</span>
            <Tip text="The page URL that was loaded when this request was made. For same-origin navigation this is the current page; for direct visits it may be the referring external site." />
          </div>
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
          <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
            <h2 className="text-sm font-medium">Timing Breakdown</h2>
            <Tip text="Phase-by-phase breakdown of where time was spent. Requires the server to send a Timing-Allow-Origin header for cross-origin requests." />
          </div>
          <div className="p-4 flex flex-wrap gap-6">
            {(Object.entries({ DNS: timing.dns, TCP: timing.tcp, TLS: timing.tls, TTFB: timing.ttfb, Transfer: timing.transfer, Total: timing.total }) as [string, number][])
              .filter(([, ms]) => ms != null)
              .map(([label, ms]) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {label}
                    {TIMING_TIPS[label] && <Tip text={TIMING_TIPS[label]} />}
                  </div>
                  <span className={`font-mono text-sm font-semibold ${
                    label === 'Total' ? (ms >= 3000 ? 'text-red-600' : ms >= 1000 ? 'text-yellow-600' : 'text-green-600') : ''
                  }`}>{ms}ms</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Response body */}
      {meta.response_body != null && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Response Body{' '}
              <span className="text-muted-foreground font-normal">(first 500 chars)</span>
            </h2>
            {meta.response_body_size != null && (() => {
              const bytes = meta.response_body_size as number
              const kb = bytes / 1024
              const label = kb >= 1024
                ? `${(kb / 1024).toFixed(1)} MB`
                : kb >= 1
                  ? `${kb.toFixed(1)} KB`
                  : `${bytes} B`
              const large = bytes >= 500_000
              const warn  = bytes >= 100_000
              return (
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  large ? 'bg-destructive/15 text-destructive font-semibold'
                        : warn  ? 'bg-yellow-500/15 text-yellow-600 font-semibold'
                                : 'bg-muted text-muted-foreground'
                }`}>
                  {large || warn ? '⚠ ' : ''}{label}
                </span>
              )
            })()}
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-foreground/80">
            {String(meta.response_body)}
          </pre>
        </div>
      )}
    </div>
  )
}

const VITAL_INFO: Record<string, { full: string; description: string }> = {
  LCP:  { full: 'Largest Contentful Paint',   description: 'How long until the largest image or text block is rendered. Measures perceived load speed — the moment the page feels "loaded" to the user.' },
  CLS:  { full: 'Cumulative Layout Shift',     description: 'How much the page layout shifts unexpectedly during load. A score of 0 is perfect (no shifts). Shifts caused by late-loading images, ads, or fonts degrade this score.' },
  INP:  { full: 'Interaction to Next Paint',   description: 'Latency from a user interaction (click, tap, keypress) to the next frame being painted. Measures overall responsiveness across the full page lifecycle.' },
  FCP:  { full: 'First Contentful Paint',      description: 'Time until the browser renders the first piece of DOM content (text, image, SVG). Marks the point where the user sees something happen.' },
  TTFB: { full: 'Time to First Byte',          description: 'Time from the navigation request until the first byte of the response arrives. Primarily reflects server processing time and network latency.' },
}

const NAV_TYPE_LABELS: Record<string, string> = {
  navigate:      'Initial navigation',
  reload:        'Page reload',
  back_forward:  'Back / Forward',
  prerender:     'Prerender',
}

function VitalBar({ value, good, poor, isCls }: { value: number; good: number; poor: number; isCls: boolean }) {
  const max = poor * 1.5
  const pct = Math.min((value / max) * 100, 100)
  const goodPct = (good / max) * 100
  const poorPct = (poor / max) * 100
  const color = value <= good ? 'bg-green-500' : value <= poor ? 'bg-yellow-500' : 'bg-red-500'
  const fmt = (v: number) => isCls ? v.toFixed(2) : `${v}ms`
  return (
    <div className="w-full space-y-1.5">
      <div className="relative h-2 rounded-full bg-muted overflow-visible">
        {/* Good zone */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-green-100" style={{ width: `${goodPct}%` }} />
        {/* Needs-improvement zone */}
        <div className="absolute inset-y-0 rounded-full bg-yellow-100" style={{ left: `${goodPct}%`, width: `${poorPct - goodPct}%` }} />
        {/* Poor zone */}
        <div className="absolute inset-y-0 rounded-full bg-red-100" style={{ left: `${poorPct}%`, right: 0 }} />
        {/* Value marker */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-1.5 rounded-full ${color} shadow`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span className="text-green-600">{fmt(good)} good</span>
        <span className="text-red-600">{fmt(poor)} poor</span>
        <span>{fmt(max)}+</span>
      </div>
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
  const isCls = name === 'CLS'
  const unit = isCls ? '' : 'ms'
  const displayValue = isCls ? value?.toFixed(3) : Math.round(value)
  const info = VITAL_INFO[name]

  const navType = meta.navigationType != null ? String(meta.navigationType) : null
  const navLabel = navType ? (NAV_TYPE_LABELS[navType] ?? navType) : null

  const contextRows: [string, string, string?][] = [
    navLabel != null                                      ? ['Navigation',    navLabel] : null,
    meta.ttfb != null                                     ? ['TTFB',          `${meta.ttfb}ms`,          'Time to First Byte — server response time during this navigation.'] : null,
    meta.redirectCount != null && Number(meta.redirectCount) > 0 ? ['Redirects', String(meta.redirectCount)] : null,
    // LCP-specific
    name === 'LCP' && meta.element != null                ? ['LCP Element',   String(meta.element),       'The DOM element identified as the Largest Contentful Paint target.'] : null,
    name === 'LCP' && meta.url != null                    ? ['Resource URL',  String(meta.url),           'The URL of the LCP image or resource.'] : null,
    name === 'LCP' && meta.loadTime != null               ? ['Load Time',     `${meta.loadTime}ms`,       'Time from when the resource started loading to when it finished.'] : null,
    name === 'LCP' && meta.renderTime != null             ? ['Render Time',   `${meta.renderTime}ms`,     'Time from resource finish to when it was painted on screen.'] : null,
    name === 'LCP' && meta.size != null                   ? ['Element Size',  `${meta.size} px²`,         'Area (width × height) of the LCP element in CSS pixels.'] : null,
    // INP-specific
    name === 'INP' && meta.eventType != null              ? ['Interaction',   String(meta.eventType),     'The type of user interaction that triggered this INP measurement (e.g. click, keydown, pointerdown).'] : null,
    name === 'INP' && meta.element != null                ? ['Element',       String(meta.element),       'The DOM element that was interacted with.'] : null,
    name === 'INP' && meta.inputDelay != null             ? ['Input Delay',   `${meta.inputDelay}ms`,     'Time from user interaction to when the browser began processing the event handler. High input delay means the main thread was busy.'] : null,
    name === 'INP' && meta.processingTime != null         ? ['Processing',    `${meta.processingTime}ms`, 'Time the browser spent running event handlers for this interaction.'] : null,
  ].filter(Boolean) as [string, string, string?][]

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Web Vital</h2>
          {info && <Tip text={`${info.full} — ${info.description}`} />}
        </div>
        <VitalRatingBadge rating={rating} />
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-mono font-bold">{displayValue}</span>
          {unit && <span className="text-lg text-muted-foreground font-mono">{unit}</span>}
          <span className="text-sm font-semibold text-muted-foreground ml-1">{name}</span>
        </div>
        {good > 0 && (
          <div className="w-full max-w-xs">
            <VitalBar value={value} good={good} poor={poor} isCls={isCls} />
          </div>
        )}
      </div>
      {contextRows.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {contextRows.map(([label, val, tip]) => (
            <div key={label} className="px-4 py-2 flex gap-4 text-sm items-center">
              <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
              <span className="font-mono text-xs break-all flex-1">{val}</span>
              {tip && <Tip text={tip} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResourceDetail({ meta }: { meta: Record<string, unknown> }) {
  const src = String(meta.src ?? meta.href ?? '—')
  const tag = String(meta.tagName ?? meta.tag ?? '').toLowerCase()

  // Infer a human-readable resource type
  const ext = src.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const resourceType =
    tag === 'img'    ? 'Image'
    : tag === 'script' ? 'Script'
    : tag === 'link'   ? 'Stylesheet'
    : tag === 'video' || tag === 'audio' || tag === 'source' ? 'Media'
    : ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext) ? 'Font'
    : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext) ? 'Image'
    : ['js', 'mjs'].includes(ext) ? 'Script'
    : ['css'].includes(ext) ? 'Stylesheet'
    : tag ? tag.toUpperCase()
    : 'Resource'

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Failed Resource Load</h2>
          <Tip text="A resource_error fires when the browser fails to load an external asset — an image, script, stylesheet, or font. This usually means a 404, a network error, or an incorrect URL. These errors are silent (no JS exception) so they're easy to miss." />
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">{resourceType}</span>
      </div>
      <div className="divide-y divide-border">
        {tag && (
          <div className="px-4 py-2 flex gap-4 text-sm items-center">
            <span className="w-24 shrink-0 text-muted-foreground">Element</span>
            <span className="font-mono text-xs">&lt;{tag}&gt;</span>
          </div>
        )}
        <div className="px-4 py-2 flex gap-4 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground">URL</span>
          <span className="font-mono text-xs break-all">{src}</span>
        </div>
        {!!meta.page && (
          <div className="px-4 py-2 flex gap-4 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">Page</span>
            <span className="font-mono text-xs break-all">{String(meta.page)}</span>
          </div>
        )}
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

  // Verify access: owner OR accepted member
  const [{ data: memberRow }] = await Promise.all([
    supabase.from('project_members').select('project_id').eq('user_id', user.id).eq('status', 'accepted'),
  ])
  const memberProjectIds = (memberRow ?? []).map((r) => r.project_id as string)

  // Fetch error via service role, then verify caller has access
  const serviceClient = createServiceRoleClient()
  const { data: rawError } = await serviceClient
    .from('errors')
    .select(`*, projects!inner(id, user_id, name)`)
    .eq('id', id)
    .single()

  if (!rawError) notFound()

  const err = rawError as unknown as ErrorWithProject
  const projectId = err.project_id
  const isOwner = err.projects.user_id === user.id
  const isMember = memberProjectIds.includes(projectId)
  if (!isOwner && !isMember) notFound()
  const meta = (err.metadata ?? {}) as Record<string, unknown>
  const eventType = err.event_type ?? 'error'

  const [{ data: suggestion }, { data: githubConn }] = await Promise.all([
    supabase
      .from('fix_suggestions')
      .select('suggestion')
      .eq('error_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    serviceClient
      .from('github_connections')
      .select('repo_owner, repo_name')
      .eq('project_id', projectId)
      .maybeSingle(),
  ])

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/dashboard/projects/${err.project_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {err.projects.name}
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <EventTypeBadge type={eventType} />
            <h1 className="font-mono text-lg font-semibold break-all leading-snug">
              {err.message}
            </h1>
          </div>
          <div className="shrink-0 self-start">
            <ResolveButton
              projectId={err.project_id}
              message={err.message}
              eventType={eventType}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {err.browser && <span>Browser: {err.browser}</span>}
          {err.os && <span>OS: {err.os}</span>}
          {err.viewport && (() => {
            // Format "1920:1080:2" → "1920×1080 @2x"
            const [w, h, dpr] = err.viewport.split(':')
            const label = w && h
              ? `${w}×${h}${dpr && dpr !== '1' ? ` @${dpr}x` : ''}`
              : err.viewport
            return <span>Viewport: {label}</span>
          })()}
          {err.connection && <span>Connection: {err.connection}</span>}
          {err.session_id && <span title={err.session_id}>Session: {err.session_id.slice(0, 8)}…</span>}
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

      {/* Session replay — shown when a recording was captured for this event */}
      {(rawError as { session_recording_id?: string | null }).session_recording_id && (
        <SessionReplayPlayer
          recordingId={(rawError as { session_recording_id: string }).session_recording_id}
        />
      )}

      {/* AI fix suggestion — only for JS errors */}
      {eventType === 'error' && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">AI Fix Suggestion</h2>
          </div>
          <div className="p-4">
            <FixSuggestion
              errorId={id}
              projectId={projectId}
              existingSuggestion={suggestion?.suggestion ?? null}
              githubRepo={githubConn?.repo_owner && githubConn?.repo_name
                ? `${githubConn.repo_owner}/${githubConn.repo_name}`
                : null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
