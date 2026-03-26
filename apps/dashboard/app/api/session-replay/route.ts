import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { gzipSync, gunzipSync } from 'zlib'
import { ingestRatelimit } from '@/lib/redis'
import { uploadRecording, S3_BUCKET } from '@/lib/s3'

export const runtime = 'nodejs'

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding, x-api-key',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) })
}

const RecordingSchema = z.object({
  session_recording_id: z.string().uuid(),
  session_id: z.string().min(1).max(200),
  duration_ms: z.number().int().min(0).max(3_600_000),
  events: z.array(z.unknown()).min(1).max(50_000),
  api_key: z.string().optional(),
})

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function POST(request: Request) {
  const CORS_HEADERS = getCorsHeaders(request)
  const headerKey = request.headers.get('x-api-key')

  let body: unknown
  try {
    if (request.headers.get('content-encoding') === 'gzip') {
      const buf = await request.arrayBuffer()
      const decompressed = gunzipSync(Buffer.from(buf)).toString('utf-8')
      body = JSON.parse(decompressed)
    } else {
      body = await request.json()
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = headerKey ?? (body as any)?.api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 400, headers: CORS_HEADERS })
  }

  const { success } = await ingestRatelimit.limit(apiKey)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: CORS_HEADERS })
  }

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401, headers: CORS_HEADERS })
  }

  const parsed = RecordingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 422, headers: CORS_HEADERS },
    )
  }

  const { session_recording_id, session_id, duration_ms, events } = parsed.data

  if (!S3_BUCKET) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503, headers: CORS_HEADERS })
  }

  const s3Key = `recordings/${project.id}/${session_id}/${session_recording_id}.json.gz`
  const compressed = gzipSync(Buffer.from(JSON.stringify(events)))

  const [, { error: dbError }] = await Promise.all([
    uploadRecording(s3Key, compressed),
    supabase.from('session_recordings').insert({
      id: session_recording_id,
      project_id: project.id,
      session_id,
      s3_key: s3Key,
      duration_ms,
    }),
  ])

  if (dbError) {
    console.error('session_recordings insert error:', dbError)
    return NextResponse.json({ error: 'Failed to store recording metadata' }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
