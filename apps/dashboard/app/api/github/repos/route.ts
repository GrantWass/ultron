import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get stored token
  const { data: conn } = await supabase
    .from('github_connections').select('access_token').eq('project_id', projectId).single()
  if (!conn) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  let token: string
  try { token = decrypt(conn.access_token) } catch {
    return NextResponse.json({ error: 'Token decryption failed' }, { status: 500 })
  }

  // Fetch all repos the user has access to (up to 100)
  const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })

  const repos = await res.json() as { full_name: string; owner: { login: string }; name: string; private: boolean }[]

  return NextResponse.json(
    repos.map((r) => ({ full_name: r.full_name, owner: r.owner.login, name: r.name, private: r.private }))
  )
}
