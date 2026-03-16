'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatRelativeTime, truncate } from '@/lib/utils'
import { EventTypeBadge } from '@/components/event-badge'
import type { ErrorRecord, EventType } from '@ultron/types'
import { Search, AlertCircle, RefreshCw, SlidersHorizontal, X } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: EventType | ''; label: string }[] = [
  { value: '',               label: 'All' },
  { value: 'error',          label: 'Errors' },
  { value: 'network',        label: 'Network' },
  { value: 'vital',          label: 'Vitals' },
  { value: 'resource_error', label: 'Resources' },
]

const TIME_RANGES = [
  { value: '',    label: 'All time' },
  { value: '5m',  label: 'Last 5 min' },
  { value: '15m', label: 'Last 15 min' },
  { value: '30m', label: 'Last 30 min' },
  { value: '1h',  label: 'Last 1 hour' },
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

// ── Select helper ─────────────────────────────────────────────────────────────

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${value ? 'border-primary/50 text-foreground' : 'text-muted-foreground'}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ErrorTableProps {
  projectId: string
}

export function ErrorTable({ projectId }: ErrorTableProps) {
  const [errors, setErrors]         = useState<ErrorRecord[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Committed filter state (triggers fetch)
  const [search, setSearch]         = useState('')
  const [eventType, setEventType]   = useState<EventType | ''>('')
  const [timeRange, setTimeRange]   = useState('')
  const [browser, setBrowser]       = useState('')
  const [os, setOs]                 = useState('')
  const [connection, setConnection] = useState('')
  const [page_, setPage_]           = useState('') // URL/page path filter

  // Pending input state
  const [searchInput, setSearchInput]   = useState('')
  const [pageInput, setPageInput]       = useState('')

  const limit = 50

  const activeFilterCount = [timeRange, browser, os, connection, page_].filter(Boolean).length

  function clearAllFilters() {
    setSearch(''); setSearchInput('')
    setEventType('')
    setTimeRange('')
    setBrowser('')
    setOs('')
    setConnection('')
    setPage_(''); setPageInput('')
    setPage(1)
  }

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        project_id: projectId,
        page: String(page),
        limit: String(limit),
      })
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
  }, [projectId, page, search, eventType, timeRange, browser, os, connection, page_])

  useEffect(() => { fetchErrors() }, [fetchErrors])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage_(pageInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)
  const hasAnyFilter = !!(search || eventType || timeRange || browser || os || connection || page_)

  return (
    <div className="space-y-3">

      {/* ── Row 1: event type tabs + time range + filter toggle + refresh ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Event type tabs */}
        <div className="flex gap-1 rounded-md border border-border p-1 bg-muted/30">
          {EVENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setEventType(value); setPage(1) }}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                eventType === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time range */}
        <select
          value={timeRange}
          onChange={(e) => { setTimeRange(e.target.value); setPage(1) }}
          className={`rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${timeRange ? 'border-primary/50 text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          {TIME_RANGES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-primary/50 bg-primary/5 text-primary'
              : 'border-input text-muted-foreground hover:text-foreground'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={fetchErrors}
          className="rounded-md border border-input p-1.5 hover:bg-accent transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {/* Clear all */}
        {hasAnyFilter && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* ── Row 2: search + page filter ─────────────────────────────────── */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search error messages..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <input
          type="text"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          placeholder="Filter by page path..."
          className="w-48 px-3 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors"
        >
          Search
        </button>
        {(search || searchInput || page_ || pageInput) && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setSearch(''); setPageInput(''); setPage_(''); setPage(1) }}
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-md border border-border bg-muted/20 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Browser</label>
            <FilterSelect
              value={browser}
              onChange={(v) => { setBrowser(v); setPage(1) }}
              placeholder="Any browser"
              options={BROWSERS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">OS</label>
            <FilterSelect
              value={os}
              onChange={(v) => { setOs(v); setPage(1) }}
              placeholder="Any OS"
              options={OPERATING_SYSTEMS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Connection</label>
            <FilterSelect
              value={connection}
              onChange={(v) => { setConnection(v); setPage(1) }}
              placeholder="Any connection"
              options={CONNECTIONS}
            />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Session ID</label>
            <input
              type="text"
              placeholder="Paste session ID..."
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onBlur={(e) => {
                // session_id filter — added as URL param when we extend the API
                // For now searches within message as a fallback
                if (e.target.value) {
                  setSearchInput(e.target.value)
                  setSearch(e.target.value)
                  setPage(1)
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {(browser || os || connection || page_ || timeRange) && (
        <div className="flex flex-wrap gap-1.5">
          {[
            browser    && { label: `Browser: ${browser}`,    clear: () => { setBrowser('');    setPage(1) } },
            os         && { label: `OS: ${os}`,              clear: () => { setOs('');         setPage(1) } },
            connection && { label: `Connection: ${connection}`, clear: () => { setConnection(''); setPage(1) } },
            page_      && { label: `Page: ${page_}`,         clear: () => { setPage_(''); setPageInput(''); setPage(1) } },
            timeRange  && { label: TIME_RANGES.find(t => t.value === timeRange)?.label, clear: () => { setTimeRange(''); setPage(1) } },
          ].filter(Boolean).map((chip: any) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-primary"
            >
              {chip.label}
              <button onClick={chip.clear} className="hover:text-destructive transition-colors">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Message</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Page</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Browser</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td>
              </tr>
            ) : errors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm">
                      {hasAnyFilter ? 'No events match your filters' : 'No events yet'}
                    </p>
                    {hasAnyFilter ? (
                      <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">
                        Clear filters
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">Install the SDK and events will appear here</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              errors.map((error) => (
                <tr key={error.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <EventTypeBadge type={error.event_type ?? 'error'} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/errors/${error.id}`} className="block hover:text-primary transition-colors">
                      <span className="font-mono text-xs text-foreground/80">
                        {truncate(error.message, 90)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-muted-foreground text-xs">
                      {error.url ? truncate(new URL(error.url).pathname, 40) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-muted-foreground text-xs">{error.browser ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatRelativeTime(error.created_at)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            {total} result{total !== 1 ? 's' : ''} · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
