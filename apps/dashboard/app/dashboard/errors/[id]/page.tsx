import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { FixSuggestion } from '@/components/fix-suggestion'
import { FrequencyChart } from '@/components/frequency-chart'
import type { ErrorRecord } from '@ultron/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch error with project ownership check
  const { data: error } = await supabase
    .from('errors')
    .select(`
      *,
      projects!inner(id, user_id, name)
    `)
    .eq('id', id)
    .eq('projects.user_id', user.id)
    .single()

  if (!error) notFound()

  const err = error as ErrorRecord & { projects: { id: string; name: string } }

  // Fetch existing fix suggestion
  const { data: suggestion } = await supabase
    .from('fix_suggestions')
    .select('suggestion')
    .eq('error_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch frequency data (last 14 days)
  const { data: frequencyData } = await supabase.rpc('error_frequency', {
    p_message: err.message,
    p_project_id: err.project_id,
  }).select()

  // Simple frequency fallback — count by day using client-side grouping isn't ideal
  // We'll pass empty array and let the chart handle it gracefully
  const chartData: { day: string; count: number }[] = []

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/dashboard/projects/${err.project_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {(error as any).projects?.name ?? 'project'}
      </Link>

      {/* Error header */}
      <div className="space-y-2">
        <h1 className="font-mono text-lg text-destructive font-semibold break-all">
          {err.message}
        </h1>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {err.url && <span>URL: {err.url}</span>}
          {err.browser && <span>Browser: {err.browser}</span>}
          {err.os && <span>OS: {err.os}</span>}
          {err.session_id && <span>Session: {err.session_id}</span>}
          <span>First seen: {formatDate(err.created_at)}</span>
        </div>
      </div>

      {/* Frequency chart */}
      {chartData.length > 0 && (
        <div className="rounded-md border border-border p-4">
          <h2 className="text-sm font-medium mb-3">Error frequency (14 days)</h2>
          <FrequencyChart data={chartData} />
        </div>
      )}

      {/* Stack trace */}
      {err.stack_trace && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Stack Trace</h2>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed text-foreground/80">
            {err.stack_trace}
          </pre>
        </div>
      )}

      {/* Metadata */}
      {err.metadata && Object.keys(err.metadata).length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <h2 className="text-sm font-medium">Metadata</h2>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto">
            {JSON.stringify(err.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Fix suggestion */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="text-sm font-medium">AI Fix Suggestion</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powered by Claude. Connect GitHub to fetch source files for better suggestions.
          </p>
        </div>
        <div className="p-4">
          <FixSuggestion
            errorId={id}
            existingSuggestion={suggestion?.suggestion ?? null}
          />
        </div>
      </div>
    </div>
  )
}
