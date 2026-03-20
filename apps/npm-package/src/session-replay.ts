// Session replay module — lazy-loads rrweb so it is never executed unless
// sessionReplay: true is passed to initTracker().  rrweb is a peer dependency
// (optional) so users who don't need replay pay zero runtime cost.

const SESSION_REPLAY_URL = 'https://ultron.live/api/session-replay'

// Force a new full DOM snapshot every 60 s so our ring buffer always
// contains at least one full snapshot and can be replayed standalone.
const CHECKOUT_INTERVAL_MS = 60_000

// Hard cap to prevent unbounded memory growth on very busy pages.
const MAX_BUFFER_EVENTS = 10_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RrwebRecord = ((opts: any) => (() => void) | undefined) & {
  addCustomEvent?: (tag: string, payload: unknown) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RrwebEvent = { type: number; data: unknown; timestamp: number; [k: string]: any }

export interface SessionReplayHandle {
  /** Snapshot the current buffer, generate a recording ID, fire-and-forget upload. */
  captureSnapshot(): string
  /** Inject a custom event into the rrweb stream (e.g. network or console events). */
  addCustomEvent(tag: string, payload: unknown): void
  stop(): void
}

export async function initSessionReplay(
  apiKey: string,
  sessionId: string,
  bufferSeconds: number,
  maskAllInputs: boolean,
): Promise<SessionReplayHandle | null> {
  let record: RrwebRecord | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getRecordConsolePlugin: (() => any) | undefined
  try {
    const mod = await import('rrweb')
    record = mod.record as RrwebRecord
    // rrweb 2.x re-exports this from @rrweb/rrweb-plugin-console-record
    getRecordConsolePlugin = (mod as Record<string, unknown>).getRecordConsolePlugin as typeof getRecordConsolePlugin
  } catch {
    console.warn('[Ultron] Session replay requires rrweb. Run: npm install rrweb')
    return null
  }

  const bufferMs = bufferSeconds * 1000
  let buffer: RrwebEvent[] = []

  const plugins: unknown[] = []
  if (typeof getRecordConsolePlugin === 'function') {
    plugins.push(getRecordConsolePlugin())
  }

  const stop = record({
    emit(event: RrwebEvent, isCheckout?: boolean) {
      if (isCheckout) {
        // New full snapshot arrived — drop events older than bufferMs
        const cutoff = event.timestamp - bufferMs
        buffer = buffer.filter((e) => e.timestamp >= cutoff)
      }
      buffer.push(event)
      if (buffer.length > MAX_BUFFER_EVENTS) {
        // Keep the last half; the oldest full-snapshot is preserved because
        // rrweb's checkoutEveryNms guarantees a fresh one within bufferMs.
        buffer = buffer.slice(-MAX_BUFFER_EVENTS / 2)
      }
    },
    maskAllInputs,
    checkoutEveryNms: CHECKOUT_INTERVAL_MS,
    plugins,
  })

  return {
    captureSnapshot(): string {
      const recordingId = crypto.randomUUID()
      const events = [...buffer]
      const startTs = events[0]?.timestamp ?? Date.now()
      const endTs = events[events.length - 1]?.timestamp ?? Date.now()
      void sendRecording(apiKey, sessionId, recordingId, events, endTs - startTs)
      return recordingId
    },
    addCustomEvent(tag: string, payload: unknown): void {
      record?.addCustomEvent?.(tag, payload)
    },
    stop: stop ?? (() => {}),
  }
}

async function sendRecording(
  apiKey: string,
  sessionId: string,
  recordingId: string,
  events: RrwebEvent[],
  durationMs: number,
): Promise<void> {
  try {
    await fetch(SESSION_REPLAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ session_recording_id: recordingId, session_id: sessionId, events, duration_ms: durationMs }),
      keepalive: true,
    })
  } catch {
    // best-effort — never throw from a monitoring SDK
  }
}
