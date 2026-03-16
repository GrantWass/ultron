import { UltronTracker } from './tracker'
import type { TrackerConfig } from './types'

export type { TrackerConfig } from './types'
export type { ErrorPayload, IngestBody } from './types'

let instance: UltronTracker | null = null

/**
 * Initialize the Ultron error tracker.
 *
 * @example
 * ```ts
 * import { initTracker } from '@ultron/tracker'
 *
 * initTracker({
 *   apiKey: 'your-project-api-key',
 *   endpoint: 'https://yourdomain.com'
 * })
 * ```
 */
export function initTracker(config: TrackerConfig): UltronTracker {
  if (instance) {
    instance.destroy()
  }

  if (!config.apiKey) throw new Error('[Ultron] apiKey is required')
  if (!config.endpoint) throw new Error('[Ultron] endpoint is required')

  // Normalize endpoint — strip trailing slash
  const normalizedConfig: TrackerConfig = {
    ...config,
    endpoint: config.endpoint.replace(/\/$/, ''),
  }

  instance = new UltronTracker(normalizedConfig)
  instance.init()
  return instance
}

/**
 * Manually capture an error outside of the automatic listeners.
 */
export function captureError(error: Error, metadata?: Record<string, unknown>): void {
  if (!instance) {
    console.warn('[Ultron] captureError called before initTracker')
    return
  }
  instance.captureError(error, metadata)
}

/**
 * Destroy the current tracker instance and flush any pending errors.
 */
export function destroyTracker(): void {
  if (instance) {
    instance.destroy()
    instance = null
  }
}

export { UltronTracker }
