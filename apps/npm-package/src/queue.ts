import type { ErrorPayload, IngestBody, TrackerConfig } from './types'

const FLUSH_INTERVAL_MS = 5000
const MAX_QUEUE_SIZE = 50
const INGEST_URL = 'https://ultron.live/api/ingest'

export class ErrorQueue {
  private queue: ErrorPayload[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private config: TrackerConfig
  private flushing = false

  constructor(config: TrackerConfig) {
    this.config = config
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)

    // Flush on page unload (guaranteed delivery via sendBeacon)
    window.addEventListener('beforeunload', () => this.flushSync())

    // Also flush when tab becomes hidden (mobile browsers may not fire beforeunload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushSync()
    })
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  enqueue(payload: ErrorPayload): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Drop oldest to make room
      this.queue.shift()
    }
    this.queue.push(payload)

    if (this.config.debug) {
      console.debug('[Ultron] Error queued:', payload.message)
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.flushing) return
    this.flushing = true

    const batch = this.queue.splice(0, this.queue.length)
    const body: IngestBody = { errors: batch }
    const endpoint = INGEST_URL

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify(body),
        keepalive: true,
      })

      if (!res.ok && this.config.debug) {
        console.warn('[Ultron] Flush failed:', res.status)
      }
    } catch (err) {
      if (this.config.debug) console.warn('[Ultron] Flush error:', err)
      // Re-queue failed batch (prepend, up to max)
      this.queue.unshift(...batch.slice(0, MAX_QUEUE_SIZE - this.queue.length))
    } finally {
      this.flushing = false
    }
  }

  flushSync(): void {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0, this.queue.length)
    const endpoint = INGEST_URL

    // sendBeacon cannot set custom headers — include api_key in body
    const body: IngestBody = { errors: batch, api_key: this.config.apiKey }

    try {
      const sent = navigator.sendBeacon(
        endpoint,
        new Blob([JSON.stringify(body)], { type: 'application/json' })
      )
      if (!sent && this.config.debug) {
        console.warn('[Ultron] sendBeacon returned false')
      }
    } catch (err) {
      if (this.config.debug) console.warn('[Ultron] flushSync error:', err)
    }
  }
}
