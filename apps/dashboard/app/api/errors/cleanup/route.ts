import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { LIMITS, type Plan } from '@/lib/plans'

// Called daily by Vercel cron (vercel.json) — requires the CRON_SECRET bearer
// token. Deletes errors older than each project owner's plan retention window
// (free: 30 days, pro: 90 days) and purges expired session-recording metadata.
// Runs with the service-role client because RLS grants the anon role no DELETE.

const PLANS: Plan[] = ['free', 'pro']

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, user_id')
  if (projectsError || !projects) {
    return NextResponse.json({ error: projectsError?.message ?? 'Failed to load projects' }, { status: 500 })
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, plan')
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const planByUser = new Map((profiles ?? []).map((p) => [p.id, (p.plan ?? 'free') as Plan]))

  // Group project ids by owner plan so each retention window is a single delete
  const projectIdsByPlan: Record<Plan, string[]> = { free: [], pro: [] }
  for (const project of projects) {
    const plan = (planByUser.get(project.user_id) ?? 'free') as Plan
    projectIdsByPlan[plan].push(project.id)
  }

  const deletedByPlan: Record<string, number> = {}
  let totalDeleted = 0

  for (const plan of PLANS) {
    const projectIds = projectIdsByPlan[plan]
    if (projectIds.length === 0) {
      deletedByPlan[plan] = 0
      continue
    }

    const cutoff = new Date(
      Date.now() - LIMITS[plan].retention_days * 24 * 60 * 60 * 1000
    ).toISOString()

    const { count, error } = await supabase
      .from('errors')
      .delete({ count: 'exact' })
      .in('project_id', projectIds)
      .lt('created_at', cutoff)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    deletedByPlan[plan] = count ?? 0
    totalDeleted += count ?? 0
  }

  // Purge session-recording metadata past its expiry (S3 objects are removed by
  // the bucket lifecycle rule; without this the DB rows accumulate forever)
  const { count: recordingsDeleted, error: recordingsError } = await supabase
    .from('session_recordings')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())
  if (recordingsError) {
    return NextResponse.json({ error: recordingsError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: totalDeleted, ...deletedByPlan, recordings_deleted: recordingsDeleted ?? 0 })
}
