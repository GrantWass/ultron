import type { TrackerConfig, ErrorPayload } from './types'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'
import { ErrorQueue } from './queue'
import { monitorNetwork } from './network'
import { collectVitals } from './vitals'
import { monitorResourceErrors } from './resource-errors'
import { initSessionReplay } from './session-replay'
import type { SessionReplayHandle } from './session-replay'

export class UltronTracker {
  private config: TrackerConfig
  private queue: ErrorQueue
  private attached = false
  private capturing = false
  private sessionReplay: SessionReplayHandle | null = null

  private originalOnError: OnErrorEventHandler | null = null
  private originalOnUnhandledRejection: ((e: PromiseRejectionEvent) => void) | null = null
  private originalConsoleError: ((...args: unknown[]) => void) | null = null
  private removeResourceErrorListener: (() => void) | null = null

  constructor(config: TrackerConfig) {
    this.config = config
    this.queue = new ErrorQueue(config)
  }

  init(): void {
    if (this.attached) return
    this.attached = true

    this.attachErrorListeners()
    this.patchConsoleError()
    this.removeResourceErrorListener = monitorResourceErrors(this.queue, this.config)
    // Pass a lazy callback so network events are forwarded into the rrweb stream
    // once session replay has initialised. Events fired before init completes are
    // silently dropped (the async gap is typically < 100 ms).
    monitorNetwork(this.queue, this.config, (tag, payload) => {
      this.sessionReplay?.addCustomEvent(tag, payload)
    })
    collectVitals(this.queue, this.config)
    this.queue.start()

    if (this.config.sessionReplay) {
      const replayCfg = typeof this.config.sessionReplay === 'object' ? this.config.sessionReplay : {}
      void initSessionReplay(
        this.config.apiKey,
        getSessionId(),
        replayCfg.bufferSeconds ?? 30,
      ).then((handle) => { this.sessionReplay = handle })
    }

    if (this.config.debug) {
      console.debug('[Ultron] Tracker initialized')
    }
  }

  private buildPayload(error: Error, metadata?: Record<string, unknown>): ErrorPayload {
    const ua = navigator.userAgent
    return {
      event_type: 'error',
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      url: window.location.href,
      browser: getBrowser(ua),
      os: getOS(ua),
      viewport: getViewport(),
      connection: getConnection(),
      session_id: getSessionId(),
      metadata,
      timestamp: Date.now(),
    }
  }

  private patchConsoleError(): void {
    this.originalConsoleError = console.error.bind(console)
    const tracker = this
    console.error = (...args: unknown[]) => {
      tracker.originalConsoleError!(...args)
      if (!tracker.capturing) {
        const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')
        const err = args.find((a) => a instanceof Error) as Error | undefined
        tracker.captureError(err ?? new Error(msg), { source: 'console.error' })
      }
    }
  }

  private attachErrorListeners(): void {
    const tracker = this

    this.originalOnError = window.onerror

    window.onerror = function (message, source, lineno, colno, error): boolean {
      if (!tracker.capturing) {
        tracker.captureError(error ?? new Error(String(message)))
      }
      if (typeof tracker.originalOnError === 'function') {
        return tracker.originalOnError.call(this, message, source, lineno, colno, error) ?? false
      }
      return false
    }

    this.originalOnUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason
      const error = reason instanceof Error ? reason : new Error(String(reason))
      if (!tracker.capturing) tracker.captureError(error)
    }

    window.addEventListener('unhandledrejection', this.originalOnUnhandledRejection)
  }

  captureError(error: Error, metadata?: Record<string, unknown>): void {
    if (this.capturing) return
    this.capturing = true
    try {
      const payload = this.buildPayload(error, metadata)
      if (this.sessionReplay) {
        payload.session_recording_id = this.sessionReplay.captureSnapshot()
      }
      this.queue.enqueue(payload)
    } finally {
      this.capturing = false
    }
  }

  destroy(): void {
    this.queue.stop()
    if (this.originalOnError !== null) window.onerror = this.originalOnError
    if (this.originalOnUnhandledRejection) {
      window.removeEventListener('unhandledrejection', this.originalOnUnhandledRejection)
    }
    if (this.originalConsoleError) console.error = this.originalConsoleError
    if (this.removeResourceErrorListener) this.removeResourceErrorListener()
    if (this.sessionReplay) this.sessionReplay.stop()
    this.attached = false
  }
}
