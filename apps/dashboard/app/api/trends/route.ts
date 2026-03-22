import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface EventRow {
  event_type: string
  message: string | null
  url: string | null
  browser: string | null
  os: string | null
  connection: string | null
  created_at: string
}

function buildPrompt(events: EventRow[]): string {
  const formatted = events.map((e) => {
    const msg = e.message
      ? e.message.length > 120 ? e.message.slice(0, 120) + '…' : e.message
      : null
    let path: string | null = null
    if (e.url) {
      try { path = new URL(e.url).pathname } catch { path = e.url }
    }
    return {
      time: e.created_at,
      type: e.event_type,
      ...(msg   && { message: msg }),
      ...(path  && { url: path }),
      ...(e.browser    && { browser: e.browser }),
      ...(e.os         && { os: e.os }),
      ...(e.connection && { connection: e.connection }),
    }
  })

  return `You are a production monitoring analyst reviewing the last ${formatted.length} events captured from a web application.

## Event Feed (newest first)
\`\`\`json
${JSON.stringify(formatted, null, 2)}
\`\`\`

## Task
Analyze this event feed and report only on what is actually meaningful. Use any of these sections that have something worth saying — skip any that don't apply to this data:

### Most Frequent Errors
Top recurring error messages or event types by count, and whether they are recent or spread out.

### Problematic Pages / URLs
URL paths that appear disproportionately often, especially if tied to a specific error type.

### Error Clusters
Meaningful groupings — shared root cause, browser/OS-specific patterns, or connection-type issues. Only include if genuine patterns exist.

### Spike Detection
Bursts of errors within a short window (5+ events within 10 minutes). Only include if a spike is actually present.

### Recommendations
Up to 3 actionable items to investigate. Only include if there is something concrete to act on.

Be direct and concise. 2–5 bullet points per section. Omit any section entirely if it would just be noise. No preamble. No closing remarks.`
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let projectId: string
  try {
    const body = await request.json()
    projectId = body.project_id
    if (!projectId) throw new Error('Missing project_id')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const service = createServiceRoleClient()

  const [{ data: ownedProject }, { data: memberRow }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])

  if (!ownedProject && !memberRow) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: events } = await service
    .from('errors')
    .select('event_type, message, url, browser, os, connection, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ error: 'No events to analyze yet' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: buildPrompt(events) }],
    maxTokens: 4000,
  })

  return result.toDataStreamResponse()
}
