'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatRelativeTime, truncate } from '@/lib/utils'
import type { ErrorRecord } from '@ultron/types'
import { Search, AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorTableProps {
  projectId: string
}

export function ErrorTable({ projectId }: ErrorTableProps) {
  const [errors, setErrors] = useState<ErrorRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const limit = 50

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        project_id: projectId,
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)

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
  }, [projectId, page, search])

  useEffect(() => {
    fetchErrors()
  }, [fetchErrors])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search errors..."
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
          className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={fetchErrors}
          className="rounded-md border border-input px-3 py-2 hover:bg-accent transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </form>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Error</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">URL</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Browser</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : errors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No errors yet</p>
                    <p className="text-xs text-muted-foreground/70">
                      Install the SDK and errors will appear here
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              errors.map((error) => (
                <tr
                  key={error.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/errors/${error.id}`}
                      className="block hover:text-primary transition-colors"
                    >
                      <span className="font-mono text-xs text-destructive">
                        {truncate(error.message, 80)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-muted-foreground text-xs">
                      {error.url ? truncate(error.url, 40) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-muted-foreground text-xs">
                      {error.browser ?? '—'}
                    </span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
