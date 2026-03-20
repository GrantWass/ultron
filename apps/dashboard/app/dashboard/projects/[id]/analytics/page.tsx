import { notFound, redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { AnalyticsPanel } from '@/components/analytics-panel'
import type { Project } from '@ultron/types'

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceRoleClient()

  const [
    { data: ownedProject },
    { data: memberRow },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('project_members').select('project_id').eq('project_id', id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
  ])

  const hasAccess = !!ownedProject || !!memberRow
  if (!hasAccess) notFound()

  const project = ownedProject ?? await serviceClient
    .from('projects').select('*').eq('id', id).single().then((r) => r.data)

  if (!project) notFound()

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{(project as Project).name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Analytics — error trends and browser breakdown
        </p>
      </div>
      <AnalyticsPanel projectId={id} />
    </div>
  )
}
