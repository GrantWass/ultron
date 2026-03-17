import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import type { Project } from '@ultron/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: ownedProjects },
    { data: memberRows },
    { data: pendingInvites },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_members')
      .select('projects(*)')
      .eq('user_id', user.id)
      .eq('status', 'accepted'),
    supabase
      .from('project_members')
      .select('token, project_id, projects(name)')
      .eq('invited_email', user.email!)
      .eq('status', 'pending'),
  ])

  const sharedProjects = (memberRows ?? [])
    .map((r) => ({ ...(r.projects as unknown as Project), is_owner: false }))
    .filter(Boolean)

  const allProjects = [
    ...(ownedProjects ?? []).map((p) => ({ ...p, is_owner: true })),
    ...sharedProjects,
  ]

  const invites = (pendingInvites ?? []).map((r) => ({
    token: r.token as string,
    projectId: r.project_id as string,
    projectName: (r.projects as any)?.name ?? 'a project',
  }))

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar projects={allProjects as Project[]} pendingInvites={invites} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
