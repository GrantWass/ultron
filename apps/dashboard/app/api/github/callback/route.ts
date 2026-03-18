import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { exchangeCodeForToken, parseOAuthState } from '@/lib/github'
import { encrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=github_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=invalid_callback`)
  }

  const cookieStore = await cookies()
  const storedCsrf = cookieStore.get('github_oauth_csrf')?.value
  if (!storedCsrf) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=csrf_missing`)
  }

  const parsed = parseOAuthState(state)
  if (!parsed || parsed.csrfToken !== storedCsrf) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=csrf_invalid`)
  }

  cookieStore.delete('github_oauth_csrf')

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  let accessToken: string
  try {
    accessToken = await exchangeCodeForToken(code)
  } catch (err) {
    console.error('GitHub token exchange error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=token_exchange_failed`)
  }

  // Fetch GitHub username
  let githubUsername = ''
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (res.ok) {
      const data = await res.json() as { login?: string }
      githubUsername = data.login ?? ''
    }
  } catch { /* non-fatal */ }

  const encryptedToken = encrypt(accessToken)

  const { error: upsertError } = await supabase
    .from('github_user_connections')
    .upsert(
      { user_id: user.id, access_token: encryptedToken, github_username: githubUsername },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('GitHub user connection upsert error:', upsertError)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=save_failed`)
  }

  return NextResponse.redirect(`${origin}/dashboard/settings?github_connected=true`)
}
