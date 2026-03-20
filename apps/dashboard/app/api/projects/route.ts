import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'


const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owned projects + member rows in parallel
  const [
    { data: owned, error: ownedError },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('project_members').select('project_id').eq('user_id', user.id).eq('status', 'accepted'),
  ])
  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 })

  const sharedIds = (memberRows ?? []).map((r) => r.project_id)
  const { data: shared } = sharedIds.length
    ? await supabase.from('projects').select('*').in('id', sharedIds)
    : { data: [] }

  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const allProjects = [
    ...(owned ?? []).map((p) => ({ ...p, is_owner: true })),
    ...(shared ?? []).filter((p) => !ownedIds.has(p.id)).map((p) => ({ ...p, is_owner: false })),
  ]

  const allProjectIds = allProjects.map((p) => p.id)
  const { data: connections } = allProjectIds.length
    ? await supabase.from('github_connections').select('project_id').in('project_id', allProjectIds)
    : { data: [] }
  const connectedIds = new Set((connections ?? []).map((c) => c.project_id))

  return NextResponse.json(allProjects.map((p) => ({ ...p, has_github_connection: connectedIds.has(p.id) })))
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name: parsed.data.name, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
