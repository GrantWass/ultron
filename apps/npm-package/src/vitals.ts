import type { TrackerConfig, ErrorPayload } from './types'
import type { ErrorQueue } from './queue'
import { getSessionId } from './session'
import { getBrowser, getOS, getViewport, getConnection } from './fingerprint'

// Thresholds from https://web.dev/vitals/
const THRESHOLDS = {
  LCP: 2500,   // poor > 4000
  CLS: 0.1,    // poor > 0.25
  INP: 200,    // poor > 500
  FID: 100,    // poor > 300
  TTFB: 800,   // poor > 1800
  FCP: 1800,   // poor > 3000
} as const

type VitalName = keyof typeof THRESHOLDS

function makePayload(
  name: VitalName,
  value: number,
  rating: 'good' | 'needs-improvement' | 'poor'
): ErrorPayload {
  const ua = navigator.userAgent
  return {
    event_type: 'vital',
    message: `${name} ${Math.round(value)}${name === 'CLS' ? '' : 'ms'} (${rating})`,
    stack: '',
    url: window.location.href,
    browser: getBrowser(ua),
    os: getOS(ua),
    viewport: getViewport(),
    connection: getConnection(),
    session_id: getSessionId(),
    metadata: { name, value, rating },
    timestamp: Date.now(),
  }
}

function getRating(name: VitalName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name]
  if (name === 'CLS') {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }
  if (value <= threshold) return 'good'
  if (value <= threshold * 2) return 'needs-improvement'
  return 'poor'
}

export function collectVitals(queue: ErrorQueue, config: TrackerConfig): void {
  const reportAll = config.reportAllVitals ?? false

  function report(name: VitalName, value: number) {
    const rating = getRating(name, value)
    if (reportAll || rating !== 'good') {
      queue.enqueue(makePayload(name, value, rating))
    }
  }

  if (typeof PerformanceObserver === 'undefined') return

  // ── LCP ──────────────────────────────────────────────────────────────────
  try {
    let lcpValue = 0
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number }
      lcpValue = last.startTime
    })
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })

    // Report on page hide — LCP is finalized when user leaves
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && lcpValue > 0) {
        report('LCP', lcpValue)
        lcpObs.disconnect()
      }
    }, { once: true })
  } catch { /* not supported */ }

  // ── CLS ──────────────────────────────────────────────────────────────────
  try {
    let clsValue = 0
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
        if (!e.hadRecentInput) clsValue += e.value
      }
    })
    clsObs.observe({ type: 'layout-shift', buffered: true })

    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        report('CLS', clsValue)
        clsObs.disconnect()
      }
    }, { once: true })
  } catch { /* not supported */ }

  // ── INP (Interaction to Next Paint) ───────────────────────────────────────
  try {
    let maxInp = 0
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { duration: number }
        if (e.duration > maxInp) maxInp = e.duration
      }
    })
    // durationThreshold is not in all TS DOM typings yet — cast to any
    inpObs.observe({ type: 'event', buffered: true } as PerformanceObserverInit)

    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && maxInp > 0) {
        report('INP', maxInp)
        inpObs.disconnect()
      }
    }, { once: true })
  } catch { /* not supported */ }

  // ── FCP (First Contentful Paint) ─────────────────────────────────────────
  try {
    const fcpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          report('FCP', entry.startTime)
          fcpObs.disconnect()
        }
      }
    })
    fcpObs.observe({ type: 'paint', buffered: true })
  } catch { /* not supported */ }

  // ── TTFB (Time to First Byte) ────────────────────────────────────────────
  try {
    const navObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { responseStart: number; requestStart: number }
        report('TTFB', e.responseStart - e.requestStart)
        navObs.disconnect()
      }
    })
    navObs.observe({ type: 'navigation', buffered: true })
  } catch { /* not supported */ }
}
