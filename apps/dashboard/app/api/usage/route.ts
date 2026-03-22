import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { LIMITS, isBillingCycleExpired, isWeekExpired, type Plan } from '@/lib/plans'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()

  // Ensure profile exists
  await service.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

  const { data: profile } = await service
    .from('profiles')
    .select('plan, monthly_event_count, billing_cycle_start, weekly_ai_count, ai_count_reset_at')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const plan = (profile.plan ?? 'free') as Plan

  // Lazily reset monthly event counter if the billing cycle has rolled over
  let eventCount = profile.monthly_event_count ?? 0
  if (isBillingCycleExpired(profile.billing_cycle_start)) {
    await service.from('profiles').update({
      monthly_event_count: 0,
      billing_cycle_start: new Date().toISOString().slice(0, 10),
    }).eq('id', user.id)
    eventCount = 0
  }

  // Lazily reset weekly AI counter
  let aiCount = profile.weekly_ai_count ?? 0
  if (isWeekExpired(profile.ai_count_reset_at)) {
    await service.from('profiles').update({
      weekly_ai_count:  0,
      ai_count_reset_at: new Date().toISOString(),
    }).eq('id', user.id)
    aiCount = 0
  }

  // Count owned projects
  const { count: projectCount } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const limits = LIMITS[plan]

  return NextResponse.json({
    plan,
    events: {
      used:  eventCount,
      limit: limits.events_per_month,
    },
    ai: {
      used:  aiCount,
      limit: limits.ai_per_week,
    },
    projects: {
      used:  projectCount ?? 0,
      limit: limits.projects,
    },
  })
}
