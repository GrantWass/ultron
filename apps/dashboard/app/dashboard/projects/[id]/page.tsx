import { notFound, redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ErrorTable } from '@/components/error-table'
import { AnalyticsPanel } from '@/components/analytics-panel'
import type { Project } from '@ultron/types'

export default async function ProjectErrorsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceRoleClient()

  // Check access: owner OR accepted member (explicit checks, not relying on RLS alone)
  const [
    { data: ownedProject },
    { data: memberRow },
    { data: ownedProjects },
    { data: acceptedMemberRows },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('project_members').select('project_id').eq('project_id', id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
    supabase.from('projects').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('project_members').select('project_id').eq('user_id', user.id).eq('status', 'accepted'),
  ])

  const hasAccess = !!ownedProject || !!memberRow
  if (!hasAccess) notFound()

  // Fetch full project data via service role if user is a member (not owner)
  const project = ownedProject ?? await serviceClient
    .from('projects').select('*').eq('id', id).single().then((r) => r.data)

  if (!project) notFound()

  // Build full project list for the switcher
  const sharedProjectIds = (acceptedMemberRows ?? []).map((r) => r.project_id as string)
  const { data: sharedProjectDetails } = sharedProjectIds.length > 0
    ? await serviceClient.from('projects').select('id, name').in('id', sharedProjectIds)
    : { data: [] as { id: string; name: string }[] }

  const allProjects = [
    ...(ownedProjects ?? []),
    ...(sharedProjectDetails ?? []),
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{(project as Project).name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Error feed — click any error for details and AI fix suggestions
        </p>
      </div>
      <AnalyticsPanel projectId={id} />
      <div className="mt-6">
        <ErrorTable projectId={id} projects={allProjects ?? []} />
      </div>
    </div>
  )
}
