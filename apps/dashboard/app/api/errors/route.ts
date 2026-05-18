import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId  = searchParams.get('project_id')
  const page       = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const grouped    = searchParams.get('grouped') === 'true'
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')
  const search     = searchParams.get('search')
  const url        = searchParams.get('url')
  const eventType  = searchParams.get('event_type')
  const browser    = searchParams.get('browser')
  const os         = searchParams.get('os')
  const connection = searchParams.get('connection')

  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!ownedProject && !memberRow) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const monthAgo      = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const effectiveFrom = from ?? monthAgo
  const offset        = (page - 1) * limit

  if (grouped) {
    const rpcParams = {
      p_project_id: projectId,
      p_limit:      limit,
      p_offset:     offset,
      p_from:       effectiveFrom,
      ...(to         ? { p_to:         to         } : {}),
      ...(search     ? { p_search:     search     } : {}),
      ...(eventType  ? { p_event_type: eventType  } : {}),
      ...(browser    ? { p_browser:    browser    } : {}),
      ...(os         ? { p_os:         os         } : {}),
      ...(connection ? { p_connection: connection } : {}),
      ...(url        ? { p_url:        url        } : {}),
    }

    const [{ data, error }, { data: total }] = await Promise.all([
      supabase.rpc('get_grouped_errors',   rpcParams),
      supabase.rpc('count_grouped_errors', { ...rpcParams, p_limit: undefined, p_offset: undefined }),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [], total: Number(total ?? 0), page, limit })
  }

  // ── Individual (ungrouped) mode ────────────────────────────────────────────
  let query = supabase
    .from('errors')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .gte('created_at', effectiveFrom)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (to)         query = query.lte('created_at', to)
  if (search)     query = query.ilike('message', `%${search}%`)
  if (url)        query = query.ilike('url', `%${url}%`)
  if (eventType)  query = query.eq('event_type', eventType)
  query = query.or('event_type.neq.vital,metadata->>rating.is.null,metadata->>rating.neq.good')
  if (browser)    query = query.ilike('browser', `%${browser}%`)
  if (os)         query = query.ilike('os', `%${os}%`)
  if (connection) query = query.eq('connection', connection)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}
