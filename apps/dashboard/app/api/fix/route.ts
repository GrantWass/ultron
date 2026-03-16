import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createServerClient } from '@/lib/supabase/server'
import { parseStackTrace } from '@/lib/stack-parser'
import { fetchGitHubFiles } from '@/lib/github'
import type { ErrorRecord, RelevantFile } from '@ultron/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function buildPrompt(error: ErrorRecord, files: RelevantFile[]): string {
  const filesSection =
    files.length > 0
      ? `\n\n## Relevant Source Files\n\n${files
          .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
          .join('\n\n')}`
      : ''

  return `You are a senior software engineer reviewing a production bug report.

## Error
**Message:** ${error.message}

**URL:** ${error.url ?? 'Unknown'}
**Browser:** ${error.browser ?? 'Unknown'}
**OS:** ${error.os ?? 'Unknown'}

## Stack Trace
\`\`\`
${error.stack_trace ?? 'No stack trace available'}
\`\`\`${filesSection}

## Task
Based on the error and available context, provide:

1. **Root Cause** — Explain what went wrong and why
2. **Fix** — Provide the specific code change needed as a unified diff
3. **Edge Cases** — Any related issues or edge cases to watch for

If no source files are available, infer the fix from the error message and stack trace alone.`
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let errorId: string
  try {
    const body = await request.json()
    errorId = body.error_id
    if (!errorId) throw new Error('Missing error_id')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch error with project ownership check
  const { data: error } = await supabase
    .from('errors')
    .select(`
      *,
      projects!inner(
        id,
        user_id,
        github_connections(
          repo_owner,
          repo_name,
          access_token
        )
      )
    `)
    .eq('id', errorId)
    .eq('projects.user_id', user.id)
    .single()

  if (!error) {
    return new Response(JSON.stringify({ error: 'Error not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check for existing suggestion
  const { data: existing } = await supabase
    .from('fix_suggestions')
    .select('suggestion')
    .eq('error_id', errorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    // Return cached suggestion as a stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`0:"${existing.suggestion.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // Fetch GitHub files if connection exists
  let files: RelevantFile[] = []
  const githubConn = (error as any).projects?.github_connections?.[0]

  if (githubConn?.access_token && githubConn.repo_owner && githubConn.repo_name) {
    const filePaths = parseStackTrace(error.stack_trace ?? '')
    if (filePaths.length > 0) {
      try {
        files = await fetchGitHubFiles(
          githubConn.access_token,
          githubConn.repo_owner,
          githubConn.repo_name,
          filePaths
        )
      } catch (err) {
        console.error('Failed to fetch GitHub files:', err)
      }
    }
  }

  const prompt = buildPrompt(error as ErrorRecord, files)

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4096,
    onFinish: async ({ text }) => {
      await supabase.from('fix_suggestions').insert({
        error_id: errorId,
        suggestion: text,
        relevant_files: files,
      })
    },
  })

  return result.toDataStreamResponse()
}
