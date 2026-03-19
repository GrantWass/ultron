import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { SidebarWrapper } from '@/components/sidebar-wrapper'
import type { ProjectWithOwnerFlag } from '@ultron/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceRoleClient()

  const [
    { data: ownedProjects },
    { data: memberRows },
    { data: pendingInviteRows },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted'),
    // RLS allows invited_email = auth.email() so regular client works here
    supabase
      .from('project_members')
      .select('token, project_id')
      .eq('invited_email', user.email!)
      .eq('status', 'pending'),
  ])

  // Fetch shared project details via service role so RLS doesn't block non-owner reads
  const sharedProjectIds = (memberRows ?? []).map((r) => r.project_id as string)
  const pendingProjectIds = (pendingInviteRows ?? []).map((r) => r.project_id as string)
  const allNeededIds = Array.from(new Set([...sharedProjectIds, ...pendingProjectIds]))

  const { data: neededProjects } = allNeededIds.length > 0
    ? await serviceClient.from('projects').select('id, name').in('id', allNeededIds)
    : { data: [] as { id: string; name: string }[] }

  const projectNameMap = Object.fromEntries((neededProjects ?? []).map((p) => [p.id, p.name]))

  const sharedProjects = sharedProjectIds.map((pid) => ({
    id: pid,
    name: projectNameMap[pid] ?? 'Unknown',
    is_owner: false,
  }))

  const allProjects = [
    ...(ownedProjects ?? []).map((p) => ({ ...p, is_owner: true })),
    ...sharedProjects,
  ]

  const invites = (pendingInviteRows ?? []).map((r) => ({
    token: r.token as string,
    projectId: r.project_id as string,
    projectName: projectNameMap[r.project_id as string] ?? 'Unknown project',
  }))

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarWrapper projects={allProjects as ProjectWithOwnerFlag[]} pendingInvites={invites} />
      <main className="flex-1 overflow-y-auto bg-background pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
