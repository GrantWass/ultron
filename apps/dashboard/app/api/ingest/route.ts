import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { ingestRatelimit } from '@/lib/redis'
import { fingerprint } from '@/lib/fingerprint'
import type { IngestPayload } from '@ultron/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const EventTypeSchema = z.enum(['error', 'network', 'vital', 'resource_error']).default('error')

const ErrorPayloadSchema = z.object({
  event_type: EventTypeSchema,
  message: z.string().min(1).max(5000),
  stack: z.string().max(50000).default(''),
  url: z.string().max(2000).default(''),
  browser: z.string().max(500).default(''),
  os: z.string().max(500).default(''),
  viewport: z.string().max(100).default(''),
  connection: z.string().max(50).default(''),
  session_id: z.string().max(100).default(''),
  metadata: z.record(z.unknown()).optional().default({}),
  timestamp: z.number().default(() => Date.now()),
})

const IngestSchema = z.object({
  errors: z.array(ErrorPayloadSchema).min(1).max(50),
  api_key: z.string().optional(),
})

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}

export async function POST(request: Request) {
  const headerKey = request.headers.get('x-api-key')

  let body: IngestPayload & { api_key?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const apiKey = headerKey ?? body.api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 400 })
  }

  const { success, reset } = await ingestRatelimit.limit(apiKey)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
      }
    )
  }

  const supabase = createServiceClient()
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const parsed = IngestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Fetch active ingest filters for this project
  const { data: activeFilters } = await supabase
    .from('ingest_filters')
    .select('fingerprint, event_type')
    .eq('project_id', project.id)

  const filteredFingerprints = new Set(
    (activeFilters ?? [])
      .filter((f) => !f.event_type)  // null event_type = match all types
      .map((f) => f.fingerprint)
  )
  const filteredByType = new Map(
    (activeFilters ?? [])
      .filter((f) => f.event_type)
      .map((f) => [`${f.event_type}:${f.fingerprint}`, true])
  )

  const allRecords = parsed.data.errors.map((e) => ({
    project_id: project.id,
    event_type: e.event_type,
    message: e.message,
    message_fingerprint: fingerprint(e.message),
    stack_trace: e.stack,
    url: e.url,
    browser: e.browser,
    os: e.os,
    viewport: e.viewport || null,
    connection: e.connection || null,
    session_id: e.session_id,
    metadata: e.metadata,
  }))

  const records = allRecords.filter((r) => {
    const fp = r.message_fingerprint
    if (filteredFingerprints.has(fp)) return false
    if (filteredByType.has(`${r.event_type}:${fp}`)) return false
    return true
  })

  if (records.length === 0) {
    return NextResponse.json({ received: 0, filtered: allRecords.length }, { headers: CORS_HEADERS })
  }

  const { error: insertError } = await supabase.from('errors').insert(records)
  if (insertError) {
    console.error('Ingest insert error:', insertError)
    return NextResponse.json({ error: 'Failed to store errors' }, { status: 500, headers: CORS_HEADERS })
  }

  const filtered = allRecords.length - records.length
  return NextResponse.json({ received: records.length, ...(filtered > 0 && { filtered }) }, { headers: CORS_HEADERS })
}
