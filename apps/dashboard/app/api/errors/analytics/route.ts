import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { EventType } from '@ultron/types'

export const dynamic = 'force-dynamic'

type Bucket = { error: number; network: number; vital: number; resource_error: number }

export interface AnalyticsResponse {
  timeline: Array<{ day: string; error: number; network: number; vital: number; resource_error: number; total: number }>
  totals: Bucket & { total: number }
  topBrowsers: Array<{ browser: string; count: number }>
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

  // Select only the fields needed for aggregation — keeps the payload small
  const { data, error } = await supabase
    .from('errors')
    .select('created_at, event_type, browser')
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

  // Fill every day in the window so the chart has no gaps
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
  for (const b of dayMap.values()) {
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
  const topBrowsers = [...browserMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([browser, count]) => ({ browser, count }))

  return NextResponse.json({ timeline, totals, topBrowsers } satisfies AnalyticsResponse)
}
