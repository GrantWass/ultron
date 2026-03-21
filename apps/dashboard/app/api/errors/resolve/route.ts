import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fingerprint } from '@/lib/fingerprint'


// GET /api/errors/resolve?project_id=&message=&event_type=
// Returns count + first 3 matching errors (preview before resolving)
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const project_id = searchParams.get('project_id')
  const message    = searchParams.get('message')
  const event_type = searchParams.get('event_type')

  if (!project_id || !message || !event_type) {
    return NextResponse.json({ error: 'project_id, message, and event_type are required' }, { status: 400 })
  }

  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', project_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', project_id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!ownedProject && !memberRow) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const fp = fingerprint(message)

  // Two safe queries — avoids raw .or() strings that break on special chars
  const [{ data: byFp, count: countFp }, { data: byMsg, count: countMsg }] = await Promise.all([
    supabase
      .from('errors')
      .select('id, url, browser, os, created_at', { count: 'exact' })
      .eq('project_id', project_id)
      .eq('event_type', event_type)
      .eq('message_fingerprint', fp)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('errors')
      .select('id, url, browser, os, created_at', { count: 'exact' })
      .eq('project_id', project_id)
      .eq('event_type', event_type)
      .is('message_fingerprint', null)
      .eq('message', message)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const count = (countFp ?? 0) + (countMsg ?? 0)
  // Merge examples, cap at 3
  const examples = [...(byFp ?? []), ...(byMsg ?? [])].slice(0, 3)

  return NextResponse.json({ count, examples })
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, message, event_type } = await request.json()

  if (!project_id || !message || !event_type) {
    return NextResponse.json(
      { error: 'project_id, message, and event_type are required' },
      { status: 400 },
    )
  }

  // Verify access: owner OR accepted member
  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', project_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', project_id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])

  if (!ownedProject && !memberRow) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const fp = fingerprint(message)

  // Two safe deletes — fingerprinted rows + legacy null-fingerprint rows
  const [{ error: e1, count: c1 }, { error: e2, count: c2 }] = await Promise.all([
    supabase
      .from('errors')
      .delete({ count: 'exact' })
      .eq('project_id', project_id)
      .eq('event_type', event_type)
      .eq('message_fingerprint', fp),
    supabase
      .from('errors')
      .delete({ count: 'exact' })
      .eq('project_id', project_id)
      .eq('event_type', event_type)
      .is('message_fingerprint', null)
      .eq('message', message),
  ])

  const error = e1 ?? e2
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: (c1 ?? 0) + (c2 ?? 0) })
}
