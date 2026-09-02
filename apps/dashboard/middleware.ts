import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - /api/ingest and /api/session-replay (public SDK endpoints, API-key auth;
     *   note /api/session-replay/[id] stays matched — it uses user sessions)
     * - /api/github/callback (OAuth callback, uses its own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/ingest$|api/session-replay$|api/github/callback).*)',
  ],
}
