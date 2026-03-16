import type { TrackerConfig, ErrorPayload } from './types'
import type { ErrorQueue } from './queue'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone',
  422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error',
  502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
}

const RESPONSE_BODY_LIMIT = 500
const BODY_SKIP_TYPES = ['image/', 'audio/', 'video/', 'font/', 'application/octet-stream']

type NetworkCategory = 'cors' | 'client_error' | 'server_error' | 'slow' | 'network_failure'

// ── Helpers ───────────────────────────────────────────────────────────────

function categorize(status: number, cors: boolean, slow: boolean): NetworkCategory {
  if (cors) return 'cors'
  if (status >= 500) return 'server_error'
  if (status >= 400) return 'client_error'
  if (slow) return 'slow'
  return 'network_failure'
}

function formatUrl(reqUrl: string): string {
  try {
    const u = new URL(reqUrl)
    return u.origin === window.location.origin
      ? u.pathname + (u.search || '')
      : reqUrl
  } catch { return reqUrl }
}

/** Parse query params into a plain object for easy filtering */
function parseParams(reqUrl: string): Record<string, string> | null {
  try {
    const params = Object.fromEntries(new URL(reqUrl).searchParams.entries())
    return Object.keys(params).length > 0 ? params : null
  } catch { return null }
}

/** Split URL into endpoint (path only) and params */
function parseEndpoint(reqUrl: string): string {
  try { return new URL(reqUrl).pathname }
  catch { return reqUrl.split('?')[0] }
}

/** Attempt to read response body text, capped at RESPONSE_BODY_LIMIT chars */
async function readResponseBody(response: Response): Promise<string | null> {
  try {
    const ct = response.headers.get('content-type') ?? ''
    if (BODY_SKIP_TYPES.some((t) => ct.includes(t))) return null
    const clone = response.clone() // must clone — body can only be read once
    const text = await clone.text()
    return text.slice(0, RESPONSE_BODY_LIMIT) + (text.length > RESPONSE_BODY_LIMIT ? '…' : '')
  } catch { return null }
}

/** Extract PerformanceResourceTiming for a URL — gives DNS/TCP/TLS/TTFB breakdown */
function getTimingBreakdown(reqUrl: string): Record<string, number> | null {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    // Match the most recent entry for this URL
    const entry = entries.filter((e) => e.name === reqUrl).pop()
    if (!entry || !entry.responseEnd) return null
    return {
      dns: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
      tcp: Math.round(entry.connectEnd - entry.connectStart),
      tls: entry.secureConnectionStart > 0
        ? Math.round(entry.connectEnd - entry.secureConnectionStart)
        : 0,
      ttfb: Math.round(entry.responseStart - entry.requestStart),
      transfer: Math.round(entry.responseEnd - entry.responseStart),
      total: Math.round(entry.responseEnd - entry.startTime),
    }
  } catch { return null }
}

function buildMessage(
  method: string, reqUrl: string, status: number,
  duration: number, category: NetworkCategory
): string {
  const url = formatUrl(reqUrl)
  const ms = `${duration}ms`
  switch (category) {
    case 'cors':          return `CORS blocked: ${method} ${url}`
    case 'server_error':  return `Server error ${status} (${STATUS_TEXT[status] ?? 'Unknown'}): ${method} ${url} — ${ms}`
    case 'client_error':  return `Client error ${status} (${STATUS_TEXT[status] ?? 'Unknown'}): ${method} ${url} — ${ms}`
    case 'slow':          return `Slow response: ${method} ${url} — ${ms}`
    case 'network_failure': return `Network failure: ${method} ${url}`
  }
}

function makePayload(message: string, meta: Record<string, unknown>): ErrorPayload {
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

function isCrossOrigin(reqUrl: string): boolean {
  try {
    if (!reqUrl.startsWith('http')) return false
    return new URL(reqUrl).origin !== window.location.origin
  } catch { return false }
}

function isCorsError(reqUrl: string, errStr: string): boolean {
  return isCrossOrigin(reqUrl) && (
    errStr.includes('Failed to fetch') ||
    errStr.includes('NetworkError') ||
    errStr.includes('Load failed')
  )
}

function shouldIgnore(reqUrl: string, endpoint: string): boolean {
  try {
    const endpointHost = new URL(endpoint).hostname
    const reqHost = reqUrl.startsWith('http') ? new URL(reqUrl).hostname : null
    if (reqHost && reqHost === endpointHost && reqUrl.includes('/api/ingest')) return true
  } catch {
    if (reqUrl.includes('/api/ingest')) return true
  }
  return false
}

// ── Fetch ─────────────────────────────────────────────────────────────────

export function monitorNetwork(queue: ErrorQueue, config: TrackerConfig): void {
  const threshold = config.slowRequestThreshold ?? 3000

  const origFetch = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const reqUrl =
      typeof input === 'string' ? input
      : input instanceof Request ? input.url
      : String(input)

    if (shouldIgnore(reqUrl, config.endpoint)) return origFetch(input, init)

    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()

    const start = Date.now()

    try {
      const response = await origFetch(input, init)
      const duration = Date.now() - start
      const slow = duration > threshold

      if (!response.ok || slow) {
        const status = response.ok ? 0 : response.status
        const category = categorize(status, false, slow)

        // Read body async — don't block the response returning to the caller
        readResponseBody(response).then((responseBody) => {
          queue.enqueue(
            makePayload(
              buildMessage(method, reqUrl, status, duration, category),
              {
                category,
                endpoint: parseEndpoint(reqUrl),
                request_url: reqUrl,
                params: parseParams(reqUrl),
                method,
                status,
                status_text: STATUS_TEXT[status] ?? null,
                duration,
                slow,
                cors: false,
                response_body: responseBody,
                timing: getTimingBreakdown(reqUrl),
                page: window.location.pathname,
                referrer: document.referrer || null,
              }
            )
          )
        })
      }
      return response
    } catch (err) {
      const duration = Date.now() - start
      const errStr = String(err)
      const cors = isCorsError(reqUrl, errStr)
      const category = categorize(0, cors, false)
      queue.enqueue(
        makePayload(
          buildMessage(method, reqUrl, 0, duration, category),
          {
            category,
            endpoint: parseEndpoint(reqUrl),
            request_url: reqUrl,
            params: parseParams(reqUrl),
            method,
            status: 0,
            status_text: null,
            duration,
            slow: false,
            cors,
            error: errStr,
            response_body: null,
            timing: null,
            page: window.location.pathname,
            referrer: document.referrer || null,
          }
        )
      )
      throw err
    }
  }

  // ── XMLHttpRequest ────────────────────────────────────────────────────────

  const OrigOpen = XMLHttpRequest.prototype.open
  const OrigSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
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
        const slow = duration > threshold
        const cors = status === 0 && isCrossOrigin(reqUrl)

        if (status === 0 || status >= 400 || slow) {
          const category = categorize(status, cors, slow)

          // Read XHR response body (already available at loadend)
          let responseBody: string | null = null
          try {
            const ct: string = this.getResponseHeader('content-type') ?? ''
            if (!BODY_SKIP_TYPES.some((t) => ct.includes(t)) && typeof this.responseText === 'string') {
              responseBody = this.responseText.slice(0, RESPONSE_BODY_LIMIT) +
                (this.responseText.length > RESPONSE_BODY_LIMIT ? '…' : '')
            }
          } catch { /* ignore */ }

          queue.enqueue(
            makePayload(
              buildMessage(method, reqUrl, status, duration, category),
              {
                category,
                endpoint: parseEndpoint(reqUrl),
                request_url: reqUrl,
                params: parseParams(reqUrl),
                method,
                status,
                status_text: STATUS_TEXT[status] ?? null,
                duration,
                slow,
                cors,
                response_body: responseBody,
                timing: getTimingBreakdown(reqUrl),
                page: window.location.pathname,
                referrer: document.referrer || null,
              }
            )
          )
        }
      })
    }

    return OrigSend.apply(this, args as Parameters<typeof OrigSend>)
  }
}

declare global {
  interface XMLHttpRequest {
    __ultron_method?: string
    __ultron_url?: string
  }
}
