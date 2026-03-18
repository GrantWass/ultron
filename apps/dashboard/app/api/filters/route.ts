import { NextResponse } from 'next/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { fingerprint } from '@/lib/fingerprint'

// ── GET /api/filters?project_id=... ───────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'Missing project_id' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify access (owner or accepted member)
  const [{ data: owned }, { data: member }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('project_id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!owned && !member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('ingest_filters')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST /api/filters ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, message, event_type, note } = body
  if (!project_id || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  const fp = fingerprint(message)

  // Only owners can create filters
  const { data: owned } = await supabase
    .from('projects').select('id').eq('id', project_id).eq('user_id', user.id).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('ingest_filters')
    .insert({
      project_id,
      fingerprint: fp,
      message,
      event_type: event_type || null,
      note: note || null,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation — filter already exists
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Filter already exists for this fingerprint' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// ── DELETE /api/filters?id=... ────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()

  // Fetch the filter to verify ownership
  const { data: filter } = await serviceClient
    .from('ingest_filters').select('project_id').eq('id', id).maybeSingle()
  if (!filter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: owned } = await supabase
    .from('projects').select('id').eq('id', filter.project_id).eq('user_id', user.id).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceClient.from('ingest_filters').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
