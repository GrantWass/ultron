import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { parseStackTrace, extractSearchKeywords } from '@/lib/stack-parser'
import { fetchGitHubFiles, searchAndFetchGitHubFiles } from '@/lib/github'
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
2. **Fix** — Provide the specific code change needed as a unified diff in a \`\`\`diff code block, with lines prefixed by \`+\` (added) or \`-\` (removed)
3. **Edge Cases** — Any related issues or edge cases to watch for

If no source files are available or they do not give insightful information, infer the fix from the error message and stack trace alone.
Be direct and actionable. Do not ask follow-up questions. Do not suggest the developer provide more information. This is a one-shot recommendation.`
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

  // Fetch error via service role, then verify caller is owner or accepted member
  const service = createServiceRoleClient()
  const { data: error } = await service
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
    .single()

  if (!error) {
    return new Response(JSON.stringify({ error: 'Error not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const projectId = (error as any).projects?.id
  const isOwner = (error as any).projects?.user_id === user.id
  if (!isOwner) {
    const { data: memberRow } = await service
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle()
    if (!memberRow) {
      return new Response(JSON.stringify({ error: 'Error not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Check for existing suggestion
  const { data: existing } = await service
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
  const rawConn = (error as any).projects?.github_connections
  const githubConn = Array.isArray(rawConn) ? rawConn[0] : rawConn

  // TODO: delete
  console.log('[fix] Raw projects data:', JSON.stringify((error as any).projects, null, 2))
  // TODO: delete
  console.log('[fix] GitHub connection present:', !!githubConn)
  // TODO: delete
  console.log('[fix] GitHub connection details:', {
    hasToken: !!githubConn?.access_token,
    repo_owner: githubConn?.repo_owner ?? null,
    repo_name: githubConn?.repo_name ?? null,
  })

  if (githubConn?.access_token && githubConn.repo_owner && githubConn.repo_name) {
    const filePaths = parseStackTrace(error.stack_trace ?? '')
    // TODO: delete
    console.log('[fix] Parsed file paths from stack trace:', filePaths)
    if (filePaths.length > 0) {
      try {
        files = await fetchGitHubFiles(
          githubConn.access_token,
          githubConn.repo_owner,
          githubConn.repo_name,
          filePaths
        )
        // TODO: delete
        console.log('[fix] Files fetched from GitHub:', files.map((f) => ({
          path: f.path,
          chars: f.content.length,
          preview: f.content.slice(0, 300),
        })))
      } catch (err) {
        console.error('Failed to fetch GitHub files:', err)
      }
    } else {
      // TODO: delete
      console.log('[fix] No file paths from stack trace — falling back to keyword search')
      try {
        const keywords = extractSearchKeywords(error.message ?? '', error.stack_trace ?? '')
        // TODO: delete
        console.log('[fix] Keyword search terms:', keywords)
        files = await searchAndFetchGitHubFiles(
          githubConn.access_token,
          githubConn.repo_owner,
          githubConn.repo_name,
          keywords,
        )
        // TODO: delete
        console.log('[fix] Files from keyword search:', files.map((f) => ({
          path: f.path,
          chars: f.content.length,
          preview: f.content.slice(0, 300),
        })))
      } catch (err) {
        console.error('Failed to search GitHub files:', err)
      }
    }
  } else {
    // TODO: delete
    console.log('[fix] Skipping GitHub fetch — missing token, repo owner, or repo name')
  }

  // TODO: delete
  console.log('[fix] Total files passed to model:', files.length)

  const prompt = buildPrompt(error as ErrorRecord, files)

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 4096,
    onFinish: async ({ text }) => {
      await service.from('fix_suggestions').insert({
        error_id: errorId,
        suggestion: text,
        relevant_files: files,
      })
    },
  })

  return result.toDataStreamResponse()
}
