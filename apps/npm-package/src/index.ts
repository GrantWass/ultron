import { UltronTracker } from './tracker'
import type { TrackerConfig } from './types'

export type { TrackerConfig, SessionReplayConfig } from './types'
export type { ErrorPayload, IngestBody } from './types'

let instance: UltronTracker | null = null

/**
 * Initialize the Ultron error tracker.
 *
 * @example
 * ```ts
 * import { initTracker } from '@ultron-dev/tracker'
 *
 * initTracker({
 *   apiKey: 'your-project-api-key',
 * })
 * ```
 */
export function initTracker(config: TrackerConfig): UltronTracker {
  if (instance) {
    instance.destroy()
  }

  if (!config.apiKey) throw new Error('[Ultron] apiKey is required')

  const normalizedConfig: TrackerConfig = { ...config }

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
