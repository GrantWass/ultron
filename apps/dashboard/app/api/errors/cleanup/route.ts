import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'


// Called by Vercel cron (vercel.json) to delete errors older than 30 days.
// Also callable manually by authenticated users.
export async function GET(request: Request) {
  // Allow Vercel cron requests (no auth) or authenticated users
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServerClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('errors')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: count ?? 0, cutoff })
}
