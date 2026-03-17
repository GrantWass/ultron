import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/debug/memberships — returns the current user's project access state
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()

  const [
    { data: ownedProjects },
    { data: allMemberships },
  ] = await Promise.all([
    supabase.from('projects').select('id, name').eq('user_id', user.id),
    serviceClient
      .from('project_members')
      .select('id, project_id, status, user_id, invited_email, token, projects(name)')
      .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`),
  ])

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    ownedProjects: ownedProjects ?? [],
    memberships: allMemberships ?? [],
  })
}
