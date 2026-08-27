import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { ingestRatelimit } from '@/lib/redis'

export const runtime = 'nodejs'

const ReleaseSchema = z.object({
  version: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._\-+\/]+$/, 'Invalid version string'),
  deployed_at: z.string().datetime().optional(),
  api_key: z.string().optional(),
})

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

/**
 * POST /api/ingest/release — record a deploy marker.
 * Auth: x-api-key header (project ingest key). Call from CI after deploy:
 *
 *   curl -X POST https://your-ultron.app/api/ingest/release \
 *     -H "x-api-key: $ULTRON_API_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"version": "v1.2.3"}'
 */
export async function POST(request: Request) {
  const headerKey = request.headers.get('x-api-key')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = headerKey ?? (body as any)?.api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 400 })
  }

  const { success } = await ingestRatelimit.limit(apiKey)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const parsed = ReleaseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const deployedAt = parsed.data.deployed_at ? new Date(parsed.data.deployed_at).toISOString() : new Date().toISOString()

  const { data, error } = await supabase
    .from('releases')
    .upsert(
      { project_id: project.id, version: parsed.data.version, deployed_at: deployedAt },
      { onConflict: 'project_id,version', ignoreDuplicates: false }
    )
    .select('id, version, deployed_at, created_at')
    .single()

  if (error) {
    console.error('release upsert error:', error)
    return NextResponse.json({ error: 'Failed to record release' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
