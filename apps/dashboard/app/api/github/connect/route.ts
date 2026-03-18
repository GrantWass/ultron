import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { getGitHubOAuthUrl } from '@/lib/github'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const csrfToken = randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('github_oauth_csrf', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return NextResponse.redirect(getGitHubOAuthUrl(csrfToken))
}
