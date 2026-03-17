import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const url = searchParams.get('url')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  // Verify access: owner OR accepted member
  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])

  if (!ownedProject && !memberRow) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const offset = (page - 1) * limit

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('errors')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .gte('created_at', monthAgo)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const eventType  = searchParams.get('event_type')
  const browser    = searchParams.get('browser')
  const os         = searchParams.get('os')
  const connection = searchParams.get('connection')

  if (from)       query = query.gte('created_at', from)
  if (to)         query = query.lte('created_at', to)
  if (search)     query = query.ilike('message', `%${search}%`)
  if (url)        query = query.ilike('url', `%${url}%`)
  if (eventType)  query = query.eq('event_type', eventType)
  if (browser)    query = query.ilike('browser', `%${browser}%`)
  if (os)         query = query.ilike('os', `%${os}%`)
  if (connection) query = query.eq('connection', connection)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}
