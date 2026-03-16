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
     * - /api/ingest (public endpoint)
     * - /api/github/callback (OAuth callback, uses its own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/ingest|api/github/callback).*)',
  ],
}
