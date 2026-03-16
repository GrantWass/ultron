import type { TrackerConfig, ErrorPayload } from './types'
import type { ErrorQueue } from './queue'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'

const TRACKED_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'AUDIO', 'VIDEO', 'SOURCE'])

export function monitorResourceErrors(queue: ErrorQueue, _config: TrackerConfig): () => void {
  const ua = navigator.userAgent

  function handler(event: ErrorEvent) {
    const target = event.target as HTMLElement | null
    if (!target || !TRACKED_TAGS.has(target.tagName)) return

    const src =
      (target as HTMLImageElement | HTMLScriptElement).src ||
      (target as HTMLLinkElement).href ||
      'unknown'

    const payload: ErrorPayload = {
      event_type: 'resource_error',
      message: `Failed to load ${target.tagName.toLowerCase()}: ${src}`,
      stack: '',
      url: window.location.href,
      browser: getBrowser(ua),
      os: getOS(ua),
      viewport: getViewport(),
      connection: getConnection(),
      session_id: getSessionId(),
      metadata: {
        tag: target.tagName.toLowerCase(),
        src,
      },
      timestamp: Date.now(),
    }

    queue.enqueue(payload)
  }

  // Must use capture phase — resource errors don't bubble
  window.addEventListener('error', handler, true)

  return () => window.removeEventListener('error', handler, true)
}
