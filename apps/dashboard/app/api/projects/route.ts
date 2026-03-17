import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owned projects
  const { data: owned, error: ownedError } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 })

  // Shared projects (accepted member)
  const { data: memberRows } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted')

  const sharedIds = (memberRows ?? []).map((r) => r.project_id)
  const { data: shared } = sharedIds.length
    ? await supabase.from('projects').select('*').in('id', sharedIds)
    : { data: [] }

  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const allProjects = [
    ...(owned ?? []).map((p) => ({ ...p, is_owner: true })),
    ...(shared ?? []).filter((p) => !ownedIds.has(p.id)).map((p) => ({ ...p, is_owner: false })),
  ]

  return NextResponse.json(allProjects)
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
