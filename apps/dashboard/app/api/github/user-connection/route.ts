import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'


// Get current user's GitHub connection status
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('github_user_connections')
    .select('github_username, created_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, github_username: data.github_username })
}

// Disconnect GitHub (removes token, all project repos remain but won't work)
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('github_user_connections').delete().eq('user_id', user.id)
  return new NextResponse(null, { status: 204 })
}
