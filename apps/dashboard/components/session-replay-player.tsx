'use client'

import { useEffect, useRef, useState } from 'react'

// ── rrweb event types ─────────────────────────────────────────────────────────
// EventType.Custom = 5, EventType.Plugin = 6
const CUSTOM_EVENT_TYPE = 5
const PLUGIN_EVENT_TYPE = 6

interface NetworkReplayEvent {
  timestamp: number
  method: string
  url: string
  status: number
  ok: boolean
  duration: number
  slow?: boolean
  error?: string
}

interface ConsoleReplayEvent {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  payload: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSideEvents(events: any[]): { network: NetworkReplayEvent[]; console: ConsoleReplayEvent[] } {
  const network: NetworkReplayEvent[] = []
  const console_: ConsoleReplayEvent[] = []

  for (const e of events) {
    if (e.type === CUSTOM_EVENT_TYPE && e.data?.tag === 'network') {
      network.push({ timestamp: e.timestamp, ...e.data.payload })
    } else if (e.type === PLUGIN_EVENT_TYPE) {
      // rrweb console plugin — plugin name varies by version, handle both
      const pluginName: string = e.data?.plugin ?? ''
      if (pluginName.includes('console')) {
        const p = e.data?.payload
        console_.push({ timestamp: e.timestamp, level: p?.level ?? 'log', payload: p?.payload ?? [] })
      }
    }
  }

  return { network, console: console_ }
}

function formatTs(baseTs: number, ts: number): string {
  const diff = ts - baseTs
  const s = Math.floor(diff / 1000)
  const ms = diff % 1000
  return `${s}.${String(ms).padStart(3, '0')}s`
}

function statusColor(ok: boolean, slow?: boolean): string {
  if (!ok) return 'text-destructive'
  if (slow) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

function levelColor(level: ConsoleReplayEvent['level']): string {
  switch (level) {
    case 'error': return 'text-destructive'
    case 'warn':  return 'text-yellow-600 dark:text-yellow-400'
    case 'debug': return 'text-muted-foreground'
    default:      return 'text-foreground'
  }
}

function NetworkPanel({ events, baseTs }: { events: NetworkReplayEvent[]; baseTs: number }) {
  if (events.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">No network requests recorded.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-1.5 text-left font-medium">Time</th>
            <th className="px-3 py-1.5 text-left font-medium">Method</th>
            <th className="px-3 py-1.5 text-left font-medium w-full">URL</th>
            <th className="px-3 py-1.5 text-right font-medium">Status</th>
            <th className="px-3 py-1.5 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
              <td className="px-3 py-1 text-muted-foreground whitespace-nowrap">{formatTs(baseTs, ev.timestamp)}</td>
              <td className="px-3 py-1 text-muted-foreground whitespace-nowrap">{ev.method}</td>
              <td className="px-3 py-1 truncate max-w-xs" title={ev.url}>{ev.url}</td>
              <td className={`px-3 py-1 text-right whitespace-nowrap ${statusColor(ev.ok, ev.slow)}`}>
                {ev.error ? 'ERR' : ev.status || '–'}
              </td>
              <td className="px-3 py-1 text-right text-muted-foreground whitespace-nowrap">{ev.duration}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConsolePanel({ events, baseTs }: { events: ConsoleReplayEvent[]; baseTs: number }) {
  if (events.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground">No console output recorded.</p>
  }
  return (
    <div className="divide-y divide-border/50">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3 px-3 py-1.5 hover:bg-muted/30 font-mono text-xs">
          <span className="text-muted-foreground whitespace-nowrap shrink-0">{formatTs(baseTs, ev.timestamp)}</span>
          <span className={`uppercase shrink-0 w-10 ${levelColor(ev.level)}`}>{ev.level}</span>
          <span className={`break-all ${levelColor(ev.level)}`}>{ev.payload.join(' ')}</span>
        </div>
      ))}
    </div>
  )
}

interface SessionReplayPlayerProps {
  recordingId: string
}

export function SessionReplayPlayer({ recordingId }: SessionReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'network' | 'console'>('network')
  const [sideEvents, setSideEvents] = useState<{
    network: NetworkReplayEvent[]
    console: ConsoleReplayEvent[]
    baseTs: number
  }>({ network: [], console: [], baseTs: 0 })

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

        setSideEvents({
          ...extractSideEvents(eventsRes.events),
          baseTs: eventsRes.events[0]?.timestamp ?? 0,
        })

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

  const tabs: { key: 'network' | 'console'; label: string; count: number }[] = [
    { key: 'network', label: 'Network', count: sideEvents.network.length },
    { key: 'console', label: 'Console', count: sideEvents.console.length },
  ]

  return (
    <div className="rounded-md border border-border">
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
      <div className={status !== 'ready' ? 'hidden' : 'overflow-hidden'}>
        <div ref={containerRef} />
      </div>

      {/* Console + Network panels */}
      {status === 'ready' && (
        <div className="border-t border-border">
          {/* Tab bar */}
          <div className="flex border-b border-border bg-muted/30">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === key
                    ? 'border-b-2 border-primary text-foreground -mb-px'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="max-h-52 overflow-y-auto bg-background">
            {activeTab === 'network'
              ? <NetworkPanel events={sideEvents.network} baseTs={sideEvents.baseTs} />
              : <ConsolePanel events={sideEvents.console} baseTs={sideEvents.baseTs} />
            }
          </div>
        </div>
      )}
    </div>
  )
}
