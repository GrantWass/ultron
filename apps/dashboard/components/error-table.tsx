'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { formatRelativeTime, truncate } from '@/lib/utils'
import { EventTypeBadge } from '@/components/event-badge'
import type { ErrorRecord, EventType } from '@ultron/types'
import {
  Search, AlertCircle, RefreshCw, X, CheckCircle,
  ChevronDown, Clock, Globe, Wifi, Monitor, Trash2,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: EventType | ''; label: string }[] = [
  { value: '',               label: 'All' },
  { value: 'error',          label: 'Errors' },
  { value: 'network',        label: 'Network' },
  { value: 'vital',          label: 'Vitals' },
  { value: 'resource_error', label: 'Resources' },
]

const TIME_RANGES = [
  { value: '',    label: 'Any time' },
  { value: '5m',  label: 'Last 5 min' },
  { value: '15m', label: 'Last 15 min' },
  { value: '30m', label: 'Last 30 min' },
  { value: '1h',  label: 'Last hour' },
  { value: '6h',  label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung Browser', 'Opera']
const OPERATING_SYSTEMS = ['macOS', 'Windows', 'iOS', 'Android', 'Linux']
const CONNECTIONS = ['wifi', '4g', '3g', '2g', 'slow-2g', 'unknown']

function timeRangeToFrom(range: string): string | null {
  const mins: Record<string, number> = {
    '5m': 5, '15m': 15, '30m': 30,
    '1h': 60, '6h': 360, '24h': 1440,
    '7d': 10080, '30d': 43200,
  }
  if (!mins[range]) return null
  return new Date(Date.now() - mins[range] * 60 * 1000).toISOString()
}

// ── Resolve modal ─────────────────────────────────────────────────────────────

interface PreviewRow { id: string; url: string | null; browser: string | null; os: string | null; created_at: string }

interface ResolveModalProps {
  error: ErrorRecord
  projectId: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  resolving: boolean
}

function ResolveModal({ error, projectId, onConfirm, onCancel, resolving }: ResolveModalProps) {
  const [preview, setPreview] = useState<{ count: number; examples: PreviewRow[] } | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    const params = new URLSearchParams({
      project_id: projectId,
      message: error.message,
      event_type: error.event_type ?? 'error',
    })
    fetch(`/api/errors/resolve?${params}`)
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => {})
  }, [projectId, error.message, error.event_type])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Resolve error</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {preview ? (
                  <span className="text-destructive font-medium">{preview.count} occurrence{preview.count !== 1 ? 's' : ''} will be deleted</span>
                ) : 'Loading…'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-md p-1 hover:bg-accent transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="font-mono text-xs text-foreground/80 break-all leading-relaxed">{error.message}</p>
          </div>

          {/* Preview rows */}
          {preview && preview.examples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {preview.examples.length < preview.count
                  ? `First ${preview.examples.length} of ${preview.count}`
                  : `${preview.count} occurrence${preview.count !== 1 ? 's' : ''}`}
              </p>
              <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                {preview.examples.map((ex) => (
                  <div key={ex.id} className="flex items-center gap-3 px-3 py-2 text-xs bg-background">
                    <span className="text-muted-foreground font-mono truncate flex-1">
                      {ex.url ? (() => { try { return new URL(ex.url).pathname } catch { return ex.url } })() : '—'}
                    </span>
                    {ex.browser && <span className="text-muted-foreground shrink-0">{ex.browser}</span>}
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">{formatRelativeTime(ex.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Only <span className="font-medium text-foreground">{error.event_type}</span> errors with this exact message are affected.</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            disabled={resolving}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={resolving || !preview}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {resolving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Resolving…</> : <><CheckCircle className="h-3.5 w-3.5" />Resolve all</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dropdown filter ───────────────────────────────────────────────────────────

function FilterDropdown({
  label, icon: Icon, value, onChange, options, placeholder,
}: {
  label: string
  icon: React.ElementType
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  const active = !!value
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 appearance-none rounded-md border pl-8 pr-6 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${active
            ? 'border-primary/50 bg-primary/5 text-primary font-medium'
            : 'border-input bg-background text-muted-foreground hover:text-foreground'
          }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      {active && (
        <button
          onClick={() => onChange('')}
          className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-destructive transition-colors"
          title={`Clear ${label}`}
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProjectOption { id: string; name: string }

interface ErrorTableProps {
  projectId: string
  projects?: ProjectOption[]
}

export function ErrorTable({ projectId: initialProjectId, projects }: ErrorTableProps) {
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId)
  const [errors, setErrors]     = useState<ErrorRecord[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [resolveTarget, setResolveTarget] = useState<ErrorRecord | null>(null)
  const [resolving, setResolving]         = useState(false)

  // Filter state
  const [search, setSearch]         = useState('')
  const [eventType, setEventType]   = useState<EventType | ''>('')
  const [timeRange, setTimeRange]   = useState('')
  const [browser, setBrowser]       = useState('')
  const [os, setOs]                 = useState('')
  const [connection, setConnection] = useState('')
  const [page_, setPage_]           = useState('')
  const [searchInput, setSearchInput] = useState('')

  const limit = 50
  const searchRef = useRef<HTMLInputElement>(null)

  function clearAllFilters() {
    setSearch(''); setSearchInput('')
    setEventType(''); setTimeRange('')
    setBrowser(''); setOs(''); setConnection('')
    setPage_(''); setPage(1)
  }

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ project_id: activeProjectId, page: String(page), limit: String(limit) })
      if (search)     params.set('search', search)
      if (eventType)  params.set('event_type', eventType)
      if (browser)    params.set('browser', browser)
      if (os)         params.set('os', os)
      if (connection) params.set('connection', connection)
      if (page_)      params.set('url', page_)
      const from = timeRangeToFrom(timeRange)
      if (from) params.set('from', from)

      const res = await fetch(`/api/errors?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setErrors(data.data)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeProjectId, page, search, eventType, timeRange, browser, os, connection, page_])

  useEffect(() => { fetchErrors() }, [fetchErrors])

  useEffect(() => {
    setPage(1); clearAllFilters()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  async function confirmResolve() {
    if (!resolveTarget) return
    setResolving(true)
    try {
      const res = await fetch('/api/errors/resolve', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: activeProjectId,
          message: resolveTarget.message,
          event_type: resolveTarget.event_type,
        }),
      })
      if (!res.ok) throw new Error('Failed to resolve')
      setResolveTarget(null)
      await fetchErrors()
    } catch (err) {
      console.error(err)
    } finally {
      setResolving(false)
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages   = Math.ceil(total / limit)
  const hasAnyFilter = !!(search || eventType || timeRange || browser || os || connection || page_)

  return (
    <div className="space-y-3">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Event type pills */}
        <div className="flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          {EVENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setEventType(value); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                eventType === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Time range */}
        <FilterDropdown
          label="Time"
          icon={Clock}
          value={timeRange}
          onChange={(v) => { setTimeRange(v); setPage(1) }}
          placeholder="Any time"
          options={TIME_RANGES.slice(1).map((t) => t.label)}
        />

        {/* Browser */}
        <FilterDropdown
          label="Browser"
          icon={Monitor}
          value={browser}
          onChange={(v) => { setBrowser(v); setPage(1) }}
          placeholder="Browser"
          options={BROWSERS}
        />

        {/* OS */}
        <FilterDropdown
          label="OS"
          icon={Monitor}
          value={os}
          onChange={(v) => { setOs(v); setPage(1) }}
          placeholder="OS"
          options={OPERATING_SYSTEMS}
        />

        {/* Connection */}
        <FilterDropdown
          label="Connection"
          icon={Wifi}
          value={connection}
          onChange={(v) => { setConnection(v); setPage(1) }}
          placeholder="Connection"
          options={CONNECTIONS}
        />

        <div className="ml-auto flex items-center gap-2">
          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <button
            onClick={fetchErrors}
            className="rounded-md border border-input p-1.5 hover:bg-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Search row ────────────────────────────────────────────────────── */}
      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search messages…"
            className="h-8 w-full pl-8 pr-3 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={page_}
            onChange={(e) => { setPage_(e.target.value); setPage(1) }}
            placeholder="Page path…"
            className={`h-8 w-40 pl-8 pr-3 rounded-md border text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors
              ${page_ ? 'border-primary/50 bg-primary/5' : 'border-input bg-background'}`}
          />
          {page_ && (
            <button
              type="button"
              onClick={() => { setPage_(''); setPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {searchInput !== search && (
          <button
            type="submit"
            className="h-8 rounded-md border border-input px-3 text-xs hover:bg-accent transition-colors whitespace-nowrap"
          >
            Search
          </button>
        )}
      </form>

      {/* ── Active filter chips ───────────────────────────────────────────── */}
      {(search || browser || os || connection || page_ || timeRange) && (
        <div className="flex flex-wrap gap-1.5">
          {[
            search     && { label: `"${truncate(search, 30)}"`,   clear: () => { setSearch(''); setSearchInput(''); setPage(1) } },
            timeRange  && { label: TIME_RANGES.find(t => t.label === timeRange || t.value === timeRange)?.label ?? timeRange, clear: () => { setTimeRange(''); setPage(1) } },
            browser    && { label: browser,                        clear: () => { setBrowser('');    setPage(1) } },
            os         && { label: os,                             clear: () => { setOs('');         setPage(1) } },
            connection && { label: connection,                     clear: () => { setConnection(''); setPage(1) } },
            page_      && { label: `path: ${page_}`,              clear: () => { setPage_('');      setPage(1) } },
          ].filter(Boolean).map((chip: any) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground/70"
            >
              {chip.label}
              <button
                onClick={chip.clear}
                className="ml-0.5 rounded-full hover:text-destructive transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
        {loading ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">
            <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-muted-foreground/50" />
            Loading…
          </div>
        ) : errors.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <AlertCircle className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm mb-1">
              {hasAnyFilter ? 'No events match your filters' : 'No events yet'}
            </p>
            {hasAnyFilter ? (
              <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">
                Clear all filters
              </button>
            ) : (
              <p className="text-xs text-muted-foreground/50">Install the SDK and events will appear here</p>
            )}
          </div>
        ) : (
          errors.map((error) => (
            <div key={error.id} className="group flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
              <EventTypeBadge type={error.event_type ?? 'error'} />
              <Link href={`/dashboard/errors/${error.id}`} className="min-w-0 flex-1 hover:text-primary transition-colors">
                <p className="text-xs font-mono font-medium text-foreground/80 truncate">
                  {error.message}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {[
                    error.url && (() => { try { return new URL(error.url!).pathname } catch { return error.url } })(),
                    error.browser,
                    formatRelativeTime(error.created_at),
                  ].filter(Boolean).join(' · ')}
                </p>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); setResolveTarget(error) }}
                title="Resolve — delete all errors with this message"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive mt-0.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {(totalPages > 1 || total > 0) && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString()} event{total !== 1 ? 's' : ''}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Resolve modal ─────────────────────────────────────────────────── */}
      {resolveTarget && (
        <ResolveModal
          error={resolveTarget}
          projectId={activeProjectId}
          onConfirm={confirmResolve}
          onCancel={() => { if (!resolving) setResolveTarget(null) }}
          resolving={resolving}
        />
      )}
    </div>
  )
}
