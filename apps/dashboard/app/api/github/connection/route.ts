import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'


const UpdateSchema = z.object({
  project_id: z.string().uuid(),
  repo_owner: z.string().max(100),
  repo_name: z.string().max(100),
})

async function getProjectRole(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  projectId: string,
  userId: string,
): Promise<'owner' | 'member' | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  if (project) return 'owner'

  const { data: member } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .single()
  if (member) return 'member'

  return null
}

// Returns { user_connected, github_username?, repo_owner?, repo_name? } or null if no access
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(supabase, projectId, user.id)
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check user-level GitHub connection
  const { data: userConn } = await supabase
    .from('github_user_connections')
    .select('github_username')
    .eq('user_id', user.id)
    .single()

  if (!userConn) {
    return NextResponse.json({ user_connected: false })
  }

  // Get project-level repo selection
  const { data: repo } = await supabase
    .from('github_connections')
    .select('repo_owner, repo_name')
    .eq('project_id', projectId)
    .single()

  return NextResponse.json({
    user_connected: true,
    github_username: userConn.github_username,
    repo_owner: repo?.repo_owner ?? null,
    repo_name: repo?.repo_name ?? null,
  })
}

// Update project repo selection (owner only)
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 })
  }

  const { project_id, repo_owner, repo_name } = parsed.data

  const role = await getProjectRole(supabase, project_id, user.id)
  if (role !== 'owner') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('github_connections')
    .upsert({ project_id, repo_owner, repo_name }, { onConflict: 'project_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Remove project repo selection (owner only)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getProjectRole(supabase, projectId, user.id)
  if (role !== 'owner') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('github_connections').delete().eq('project_id', projectId)

  return new NextResponse(null, { status: 204 })
}
