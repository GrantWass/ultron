'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Trash2, X, RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface PreviewRow { id: string; url: string | null; browser: string | null; created_at: string }

interface ResolveButtonProps {
  projectId: string
  message: string
  eventType: string
}

export function ResolveButton({ projectId, message, eventType }: ResolveButtonProps) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ count: number; examples: PreviewRow[] } | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !loading) setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading])

  useEffect(() => {
    if (!open) return
    setPreview(null)
    const params = new URLSearchParams({ project_id: projectId, message, event_type: eventType })
    fetch(`/api/errors/resolve?${params}`)
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => {})
  }, [open, projectId, message, eventType])

  async function handleResolve() {
    setLoading(true)
    try {
      const res = await fetch('/api/errors/resolve', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, message, event_type: eventType }),
      })
      if (!res.ok) throw new Error('Failed to resolve')
      router.push(`/dashboard/projects/${projectId}`)
    } catch {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Resolve all similar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setOpen(false) }}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between p-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Resolve error</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preview
                      ? <span className="text-destructive font-medium">{preview.count} occurrence{preview.count !== 1 ? 's' : ''} will be deleted</span>
                      : 'Loading…'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-md p-1 hover:bg-accent transition-colors text-muted-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <p className="font-mono text-xs text-foreground/80 break-all leading-relaxed">{message}</p>
              </div>

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

              <p className="text-xs text-muted-foreground">
                Only <span className="font-medium text-foreground">{eventType}</span> errors with this exact message are affected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={loading || !preview}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {loading
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Resolving…</>
                  : <><CheckCircle className="h-3.5 w-3.5" />Resolve all</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
