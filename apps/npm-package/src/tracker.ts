import type { TrackerConfig, ErrorPayload } from './types'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'
import { ErrorQueue } from './queue'
import { monitorNetwork } from './network'
import { collectVitals } from './vitals'
import { monitorResourceErrors } from './resource-errors'

export class UltronTracker {
  private config: TrackerConfig
  private queue: ErrorQueue
  private attached = false
  private capturing = false

  private originalOnError: OnErrorEventHandler | null = null
  private originalOnUnhandledRejection: ((e: PromiseRejectionEvent) => void) | null = null
  private removeResourceErrorListener: (() => void) | null = null

  constructor(config: TrackerConfig) {
    this.config = config
    this.queue = new ErrorQueue(config)
  }

  init(): void {
    if (this.attached) return
    this.attached = true

    this.attachErrorListeners()
    this.removeResourceErrorListener = monitorResourceErrors(this.queue, this.config)
    monitorNetwork(this.queue, this.config)
    collectVitals(this.queue, this.config)
    this.queue.start()

    if (this.config.debug) {
      console.debug('[Ultron] Tracker initialized for endpoint:', this.config.endpoint)
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
      this.queue.enqueue(this.buildPayload(error, metadata))
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
    if (this.removeResourceErrorListener) this.removeResourceErrorListener()
    this.attached = false
  }
}
