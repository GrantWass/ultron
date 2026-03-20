'use client'

import { useEffect, useRef, useState } from 'react'

interface SessionReplayPlayerProps {
  recordingId: string
}

export function SessionReplayPlayer({ recordingId }: SessionReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let destroyed = false

    async function load() {
      try {
        // @ts-expect-error — CSS module, no type definition needed
        await import('rrweb-player/dist/style.css')
        const [eventsRes, { default: RrwebPlayer }] = await Promise.all([
          fetch(`/api/session-replay/${recordingId}`).then((r) => {
            if (!r.ok) throw new Error(`Failed to load recording (${r.status})`)
            return r.json()
          }),
          import('rrweb-player'),
        ])

        if (destroyed) return

        // rrweb-player mounts directly onto a DOM element
        const player = new RrwebPlayer({
          target: container,
          props: {
            events: eventsRes.events,
            width: container.clientWidth || 800,
            autoPlay: false,
            showController: true,
            skipInactive: true,
          },
        })

        setStatus('ready')
        return () => { try { (player as unknown as { $destroy(): void }).$destroy() } catch { /* ignore */ } }
      } catch (err) {
        if (!destroyed) {
          setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
          setStatus('error')
        }
      }
    }

    const cleanup = load()
    return () => {
      destroyed = true
      cleanup.then((fn) => fn?.())
    }
  }, [recordingId])

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50">
        <h2 className="text-sm font-medium">Session Replay</h2>
      </div>
      {status === 'loading' && (
        <div className="p-6 text-sm text-muted-foreground text-center">Loading recording…</div>
      )}
      {status === 'error' && (
        <div className="p-6 text-sm text-destructive text-center">{errorMsg}</div>
      )}
      {/* rrweb-player mounts its own UI into this div */}
      <div
        ref={containerRef}
        className={status !== 'ready' ? 'hidden' : undefined}
      />
    </div>
  )
}
