import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/invite/[token] — public: return invite info for the acceptance page
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const serviceClient = createServiceRoleClient()

  const { data: invite } = await serviceClient
    .from('project_members')
    .select('id, invited_email, status, project_id, projects(name)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
  if (invite.status === 'accepted') return NextResponse.json({ error: 'Already accepted' }, { status: 410 })

  return NextResponse.json({
    invitedEmail: invite.invited_email,
    projectId: invite.project_id,
    projectName: (invite.projects as { name: string } | null)?.name ?? 'a project',
  })
}

// POST /api/invite/[token] — authenticated: accept the invite
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()

  const { data: invite } = await serviceClient
    .from('project_members')
    .select('id, invited_email, status, project_id')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
  if (invite.status === 'accepted') return NextResponse.json({ error: 'Already accepted' }, { status: 410 })

  if (invite.invited_email !== user.email) {
    return NextResponse.json(
      { error: `This invite is for ${invite.invited_email}` },
      { status: 403 }
    )
  }

  const { error } = await serviceClient
    .from('project_members')
    .update({
      status: 'accepted',
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ projectId: invite.project_id })
}
