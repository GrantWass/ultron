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

  // Validate CSRF token
  const cookieStore = await cookies()
  const storedCsrf = cookieStore.get('github_oauth_csrf')?.value
  if (!storedCsrf) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=csrf_missing`)
  }

  const parsed = parseOAuthState(state)
  if (!parsed || parsed.csrfToken !== storedCsrf) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=csrf_invalid`)
  }

  // Clear CSRF cookie
  cookieStore.delete('github_oauth_csrf')

  // Verify session and project ownership
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', parsed.projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=project_not_found`)
  }

  // Exchange code for access token
  let accessToken: string
  try {
    accessToken = await exchangeCodeForToken(code)
  } catch (err) {
    console.error('GitHub token exchange error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=token_exchange_failed`)
  }

  // Get repo info from GitHub
  const userResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=1', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
  })

  // We'll store without repo info initially — user can pick in settings
  const encryptedToken = encrypt(accessToken)

  // Upsert GitHub connection
  const { error: upsertError } = await supabase
    .from('github_connections')
    .upsert(
      {
        project_id: parsed.projectId,
        repo_owner: '',
        repo_name: '',
        access_token: encryptedToken,
      },
      { onConflict: 'project_id' }
    )

  if (upsertError) {
    console.error('GitHub connection upsert error:', upsertError)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=save_failed`)
  }

  return NextResponse.redirect(
    `${origin}/dashboard/settings?project_id=${parsed.projectId}&github_connected=true`
  )
}
