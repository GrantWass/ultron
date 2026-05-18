import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { LIMITS } from '@/lib/plans'

// Called by Vercel cron (vercel.json) to delete errors per plan retention policy.
// Also callable manually by authenticated users.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role bypasses RLS so the cron can delete across all projects.
  const service = createServiceRoleClient()

  const freeCutoff = new Date(Date.now() - LIMITS.free.retention_days * 24 * 60 * 60 * 1000).toISOString()
  const proCutoff  = new Date(Date.now() - LIMITS.pro.retention_days  * 24 * 60 * 60 * 1000).toISOString()

  // Separate project IDs by their owner's plan.
  const [{ data: profiles }, { data: projects }] = await Promise.all([
    service.from('profiles').select('id, plan'),
    service.from('projects').select('id, user_id'),
  ])

  const proUserIds    = new Set((profiles ?? []).filter(p => p.plan === 'pro').map(p => p.id))
  const freeProjectIds = (projects ?? []).filter(p => !proUserIds.has(p.user_id)).map(p => p.id)
  const proProjectIds  = (projects ?? []).filter(p =>  proUserIds.has(p.user_id)).map(p => p.id)

  const [freeResult, proResult] = await Promise.all([
    freeProjectIds.length > 0
      ? service.from('errors').delete({ count: 'exact' }).in('project_id', freeProjectIds).lt('created_at', freeCutoff)
      : { error: null, count: 0 },
    proProjectIds.length > 0
      ? service.from('errors').delete({ count: 'exact' }).in('project_id', proProjectIds).lt('created_at', proCutoff)
      : { error: null, count: 0 },
  ])

  if (freeResult.error) return NextResponse.json({ error: freeResult.error.message }, { status: 500 })
  if (proResult.error)  return NextResponse.json({ error: proResult.error.message  }, { status: 500 })

  return NextResponse.json({
    deleted: (freeResult.count ?? 0) + (proResult.count ?? 0),
    free: { deleted: freeResult.count ?? 0, cutoff: freeCutoff },
    pro:  { deleted: proResult.count  ?? 0, cutoff: proCutoff  },
  })
}
