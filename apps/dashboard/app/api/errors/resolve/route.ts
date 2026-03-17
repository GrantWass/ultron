import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  const { error, count } = await supabase
    .from('errors')
    .delete({ count: 'exact' })
    .eq('project_id', project_id)
    .eq('message', message)
    .eq('event_type', event_type)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: count ?? 0 })
}
