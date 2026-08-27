import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = new URL(request.url).searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

  // Verify access: owner OR accepted member
  const [{ data: owned }, { data: member }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!owned && !member) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('releases')
    .select('id, version, deployed_at, created_at')
    .eq('project_id', projectId)
    .order('deployed_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Failed to load releases' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const CreateReleaseSchema = z.object({
  project_id: z.string().uuid(),
  version: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._\-+\/]+$/, 'Invalid version string'),
  deployed_at: z.string().datetime().optional(),
})

/** Dashboard-authenticated release creation (manual entry). CI should use POST /api/ingest/release. */
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CreateReleaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 })
  }

  const { project_id, version } = parsed.data
  const { data: owned } = await supabase
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const deployedAt = parsed.data.deployed_at ? new Date(parsed.data.deployed_at).toISOString() : new Date().toISOString()

  const { createServiceRoleClient } = await import('@/lib/supabase/server')
  // Use service role for upsert to bypass any RLS quirks, but ownership already verified
  const svc = createServiceRoleClient()

  const { data, error } = await svc
    .from('releases')
    .upsert(
      { project_id, version, deployed_at: deployedAt },
      { onConflict: 'project_id,version', ignoreDuplicates: false }
    )
    .select('id, version, deployed_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create release' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
