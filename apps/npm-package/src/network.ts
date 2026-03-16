import type { TrackerConfig, ErrorPayload } from './types'
import type { ErrorQueue } from './queue'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'

function makePayload(
  message: string,
  meta: Record<string, unknown>,
  config: TrackerConfig
): ErrorPayload {
  const ua = navigator.userAgent
  return {
    event_type: 'network',
    message,
    stack: '',
    url: window.location.href,
    browser: getBrowser(ua),
    os: getOS(ua),
    viewport: getViewport(),
    connection: getConnection(),
    session_id: getSessionId(),
    metadata: meta,
    timestamp: Date.now(),
  }
}

function shouldIgnore(reqUrl: string, endpoint: string): boolean {
  // Never track our own ingest calls — would cause infinite loop
  try {
    const endpointHost = new URL(endpoint).hostname
    const reqHost = reqUrl.startsWith('http') ? new URL(reqUrl).hostname : null
    if (reqHost && reqHost === endpointHost && reqUrl.includes('/api/ingest')) return true
  } catch {
    // relative URL — check path only
    if (reqUrl.includes('/api/ingest')) return true
  }
  return false
}

export function monitorNetwork(queue: ErrorQueue, config: TrackerConfig): void {
  const threshold = config.slowRequestThreshold ?? 3000

  // ── Fetch ────────────────────────────────────────────────────────────────
  const origFetch = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const reqUrl =
      typeof input === 'string'
        ? input
        : input instanceof Request
        ? input.url
        : String(input)

    if (shouldIgnore(reqUrl, config.endpoint)) {
      return origFetch(input, init)
    }

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()

    const start = Date.now()

    try {
      const response = await origFetch(input, init)
      const duration = Date.now() - start

      if (!response.ok || duration > threshold) {
        queue.enqueue(
          makePayload(
            `${method} ${reqUrl} ${response.status} (${duration}ms)`,
            {
              request_url: reqUrl,
              method,
              status: response.status,
              duration,
              slow: duration > threshold,
            },
            config
          )
        )
      }
      return response
    } catch (err) {
      const duration = Date.now() - start
      queue.enqueue(
        makePayload(
          `${method} ${reqUrl} network error (${duration}ms)`,
          { request_url: reqUrl, method, status: 0, duration, error: String(err) },
          config
        )
      )
      throw err
    }
  }

  // ── XMLHttpRequest ────────────────────────────────────────────────────────
  const OrigOpen = XMLHttpRequest.prototype.open
  const OrigSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__ultron_method = method.toUpperCase()
    this.__ultron_url = String(url)
    // @ts-expect-error — rest args passed through
    return OrigOpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function (...args) {
    const method: string = this.__ultron_method ?? 'GET'
    const reqUrl: string = this.__ultron_url ?? ''
    const start = Date.now()

    if (!shouldIgnore(reqUrl, config.endpoint)) {
      this.addEventListener('loadend', () => {
        const duration = Date.now() - start
        const status: number = this.status

        if (status === 0 || status >= 400 || duration > threshold) {
          queue.enqueue(
            makePayload(
              `${method} ${reqUrl} ${status || 'network error'} (${duration}ms)`,
              {
                request_url: reqUrl,
                method,
                status,
                duration,
                slow: duration > threshold,
              },
              config
            )
          )
        }
      })
    }

    return OrigSend.apply(this, args as Parameters<typeof OrigSend>)
  }
}

// Extend XMLHttpRequest with our tracking properties
declare global {
  interface XMLHttpRequest {
    __ultron_method?: string
    __ultron_url?: string
  }
}
