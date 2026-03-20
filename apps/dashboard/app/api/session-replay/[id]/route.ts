import { NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { downloadRecording } from '@/lib/s3'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()

  // Fetch recording metadata and verify caller has access to its project
  const { data: recording } = await serviceClient
    .from('session_recordings')
    .select('s3_key, project_id')
    .eq('id', id)
    .single()

  if (!recording) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', recording.project_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', recording.project_id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])
  if (!ownedProject && !memberRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const compressed = await downloadRecording(recording.s3_key)
  const json = gunzipSync(compressed).toString('utf-8')
  const events = JSON.parse(json)

  return NextResponse.json({ events }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
