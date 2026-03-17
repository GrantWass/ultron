import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// GET /api/projects/[id]/members — list members (owner only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: members } = await supabase
    .from('project_members')
    .select('id, invited_email, user_id, role, status, invited_at, accepted_at')
    .eq('project_id', id)
    .order('invited_at', { ascending: false })

  return NextResponse.json(members ?? [])
}

// POST /api/projects/[id]/members — invite by email (owner only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: project } = await supabase
    .from('projects').select('id, name').eq('id', id).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Can't invite yourself
  if (email === user.email) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('project_members').select('id, status').eq('project_id', id).eq('invited_email', email).single()
  if (existing) {
    const msg = existing.status === 'accepted' ? 'Already a member' : 'Invite already sent'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  const token = randomBytes(32).toString('hex')

  const { data: member, error: insertError } = await supabase
    .from('project_members')
    .insert({
      project_id: id,
      invited_email: email,
      user_id: null, // resolved when the invite is accepted
      token,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Send invite email
  const origin = new URL(request.url).origin
  const inviteUrl = `${origin}/invite/${token}`
  try {
    await sendInviteEmail({
      to: email,
      inviterEmail: user.email!,
      projectName: project.name,
      inviteUrl,
    })
  } catch (err) {
    console.error('[Ultron] Failed to send invite email:', err)
    // Don't fail the request — invite row is created, link can be shared manually
  }

  return NextResponse.json(member, { status: 201 })
}
