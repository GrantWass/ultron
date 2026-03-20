import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fingerprint } from '@/lib/fingerprint'
import type { EventType } from '@ultron/types'

export const dynamic = 'force-dynamic'

type Bucket = { error: number; network: number; vital: number; resource_error: number }

export interface HeatmapCell {
  dow: number   // 0=Sun … 6=Sat
  hour: number  // 0–23
  count: number
}

export interface VitalSummary {
  name: string
  p75: number
  rating: 'good' | 'needs-improvement' | 'poor'
  total: number  // total readings including good
}

export interface PageVitalBad {
  /** Pathname extracted from the full URL */
  url: string
  vitals: Array<{
    name: string
    hasPoor: boolean   // true when any reading was 'poor' (vs needs-improvement only)
    count: number
  }>
  total: number        // sum across all vitals for this page
}

export interface TopError {
  fingerprint: string
  message: string
  count: number
  first_seen: string
  last_seen: string
  sample_id: string
  event_type: string
}

export interface AnalyticsResponse {
  timeline: Array<{ day: string; error: number; network: number; vital: number; resource_error: number; total: number }>
  totals: Bucket & { total: number }
  topBrowsers: Array<{ browser: string; count: number }>
  heatmap: HeatmapCell[]
  hasFullVitals: boolean
  vitalSummaries: VitalSummary[]   // populated when hasFullVitals (p75 over full population)
  pageVitals: PageVitalBad[]       // populated when !hasFullVitals (bad readings per page)
  topErrors: TopError[]
}

// Matches thresholds in apps/npm-package/src/vitals.ts
const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  LCP:  [2500, 4000],
  CLS:  [0.1, 0.25],
  INP:  [200, 500],
  FID:  [100, 300],
  TTFB: [800, 1800],
  FCP:  [1800, 3000],
}
const VITAL_ORDER = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB', 'FID']

function p75(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.max(0, Math.ceil(0.75 * s.length) - 1)]
}

function vitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = VITAL_THRESHOLDS[name]
  if (!t) return 'good'
  if (value <= t[0]) return 'good'
  if (value <= t[1]) return 'needs-improvement'
  return 'poor'
}


export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

  // Verify access: owner OR accepted member
  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!ownedProject && !memberRow) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('errors')
    .select('id, created_at, event_type, browser, message, metadata, url')
    .eq('project_id', projectId)
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // ── Timeline (group by day) ──────────────────────────────────────────────
  const dayMap = new Map<string, Bucket>()
  for (const row of rows) {
    const day = row.created_at.slice(0, 10)
    if (!dayMap.has(day)) dayMap.set(day, { error: 0, network: 0, vital: 0, resource_error: 0 })
    const bucket = dayMap.get(day)!
    const et = row.event_type as EventType
    if (et in bucket) bucket[et]++
  }

  const timeline: AnalyticsResponse['timeline'] = []
  const cursor = new Date(since)
  const now = new Date()
  while (cursor <= now) {
    const day = cursor.toISOString().slice(0, 10)
    const b = dayMap.get(day) ?? { error: 0, network: 0, vital: 0, resource_error: 0 }
    timeline.push({ day, ...b, total: b.error + b.network + b.vital + b.resource_error })
    cursor.setDate(cursor.getDate() + 1)
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals: AnalyticsResponse['totals'] = { error: 0, network: 0, vital: 0, resource_error: 0, total: 0 }
  for (const b of Array.from(dayMap.values())) {
    totals.error          += b.error
    totals.network        += b.network
    totals.vital          += b.vital
    totals.resource_error += b.resource_error
  }
  totals.total = totals.error + totals.network + totals.vital + totals.resource_error

  // ── Top browsers ─────────────────────────────────────────────────────────
  const browserMap = new Map<string, number>()
  for (const row of rows) {
    const b = row.browser ?? 'Unknown'
    browserMap.set(b, (browserMap.get(b) ?? 0) + 1)
  }
  const topBrowsers = Array.from(browserMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([browser, count]) => ({ browser, count }))

  // ── Heatmap (day-of-week × hour UTC) ─────────────────────────────────────
  const heatmapMap = new Map<string, number>()
  for (const row of rows) {
    const d = new Date(row.created_at)
    const key = `${d.getUTCDay()}:${d.getUTCHours()}`
    heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1)
  }
  const heatmap: HeatmapCell[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmap.push({ dow, hour, count: heatmapMap.get(`${dow}:${hour}`) ?? 0 })
    }
  }

  // ── Web vitals ───────────────────────────────────────────────────────────
  // If any 'good' reading arrives, reportAllVitals=true is in use and we have
  // the full population — compute honest p75s.  Otherwise fall back to the
  // per-page bad-readings view so we never show misleading percentiles.
  type VEntry = { values: number[]; good: number; needsImprovement: number; poor: number }
  const vitalsMap = new Map<string, VEntry>()
  let hasFullVitals = false
  for (const row of rows) {
    if (row.event_type !== 'vital') continue
    const meta = row.metadata as { name?: string; value?: number; rating?: string } | null
    if (!meta?.name || meta.value == null) continue
    const r = (meta.rating as string) || vitalRating(meta.name, meta.value as number)
    if (r === 'good') hasFullVitals = true
    if (!vitalsMap.has(meta.name)) vitalsMap.set(meta.name, { values: [], good: 0, needsImprovement: 0, poor: 0 })
    const e = vitalsMap.get(meta.name)!
    e.values.push(meta.value as number)
    if (r === 'good') e.good++
    else if (r === 'needs-improvement') e.needsImprovement++
    else e.poor++
  }

  // p75 summaries — only meaningful when the full distribution is present
  const vitalSummaries: VitalSummary[] = hasFullVitals
    ? Array.from(vitalsMap.entries())
        .sort((a, b) => (VITAL_ORDER.indexOf(a[0]) + 99) - (VITAL_ORDER.indexOf(b[0]) + 99))
        .map(([name, { values, good, needsImprovement, poor }]) => {
          const pv = p75(values)
          return { name, p75: pv, rating: vitalRating(name, pv), total: good + needsImprovement + poor }
        })
    : []

  // Per-page bad-readings view — only meaningful when full distribution is absent
  type VPageEntry = Map<string, { count: number; hasPoor: boolean }>
  const pageVitalsMap = new Map<string, VPageEntry>()
  if (!hasFullVitals) {
    for (const row of rows) {
      if (row.event_type !== 'vital') continue
      const meta = row.metadata as { name?: string; value?: number; rating?: string } | null
      if (!meta?.name) continue
      const r = (meta.rating as string) || (meta.value != null ? vitalRating(meta.name, meta.value as number) : 'poor')
      if (r === 'good') continue
      let pathname = row.url ?? '(unknown)'
      try { pathname = new URL(pathname).pathname } catch { /* keep as-is */ }
      if (!pageVitalsMap.has(pathname)) pageVitalsMap.set(pathname, new Map())
      const byVital = pageVitalsMap.get(pathname)!
      const prev = byVital.get(meta.name) ?? { count: 0, hasPoor: false }
      byVital.set(meta.name, { count: prev.count + 1, hasPoor: prev.hasPoor || r === 'poor' })
    }
  }
  const pageVitals: PageVitalBad[] = Array.from(pageVitalsMap.entries())
    .map(([url, byVital]) => {
      const vitals = Array.from(byVital.entries())
        .sort((a, b) => VITAL_ORDER.indexOf(a[0]) - VITAL_ORDER.indexOf(b[0]))
        .map(([name, { count, hasPoor }]) => ({ name, count, hasPoor }))
      return { url, vitals, total: vitals.reduce((s, v) => s + v.count, 0) }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // ── Top errors by fingerprint ────────────────────────────────────────────
  type FpEntry = { message: string; count: number; first_seen: string; last_seen: string; sample_id: string; event_type: string }
  const fpMap = new Map<string, FpEntry>()
  for (const row of rows) {
    if (row.event_type === 'vital') continue
    const fp = fingerprint(row.message)
    const ex = fpMap.get(fp)
    if (!ex) {
      fpMap.set(fp, { message: row.message, count: 1, first_seen: row.created_at, last_seen: row.created_at, sample_id: row.id, event_type: row.event_type })
    } else {
      ex.count++
      if (row.created_at < ex.first_seen) ex.first_seen = row.created_at
      if (row.created_at > ex.last_seen) { ex.last_seen = row.created_at; ex.sample_id = row.id }
    }
  }
  const topErrors: TopError[] = Array.from(fpMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([fp, d]) => ({ fingerprint: fp, ...d }))

  return NextResponse.json({ timeline, totals, topBrowsers, heatmap, hasFullVitals, vitalSummaries, pageVitals, topErrors } satisfies AnalyticsResponse)
}
