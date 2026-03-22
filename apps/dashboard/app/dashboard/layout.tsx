import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { SidebarWrapper } from '@/components/sidebar-wrapper'
import { LIMITS, isBillingCycleExpired, isWeekExpired, type Plan } from '@/lib/plans'
import type { ProjectWithOwnerFlag } from '@ultron/types'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export type UsageData = {
  plan: Plan
  events:   { used: number; limit: number }
  ai:       { used: number; limit: number }
  projects: { used: number; limit: number }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceRoleClient()

  // Ensure profile row exists for usage queries
  await serviceClient.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

  const [
    { data: ownedProjects },
    { data: memberRows },
    { data: pendingInviteRows },
    { data: profile },
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
    serviceClient
      .from('profiles')
      .select('plan, monthly_event_count, billing_cycle_start, weekly_ai_count, ai_count_reset_at')
      .eq('id', user.id)
      .single(),
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

  // Build usage snapshot for the sidebar
  const plan = ((profile?.plan ?? 'free') as Plan)
  const limits = LIMITS[plan]

  let eventCount = profile?.monthly_event_count ?? 0
  if (profile && isBillingCycleExpired(profile.billing_cycle_start)) {
    await serviceClient.from('profiles').update({ monthly_event_count: 0, billing_cycle_start: new Date().toISOString().slice(0, 10) }).eq('id', user.id)
    eventCount = 0
  }

  let aiCount = profile?.weekly_ai_count ?? 0
  if (profile && isWeekExpired(profile.ai_count_reset_at)) {
    await serviceClient.from('profiles').update({ weekly_ai_count: 0, ai_count_reset_at: new Date().toISOString() }).eq('id', user.id)
    aiCount = 0
  }

  const usage: UsageData = {
    plan,
    events:   { used: eventCount,              limit: limits.events_per_month },
    ai:       { used: aiCount,                 limit: limits.ai_per_week },
    projects: { used: ownedProjects?.length ?? 0, limit: limits.projects },
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarWrapper projects={allProjects as ProjectWithOwnerFlag[]} pendingInvites={invites} usage={usage} />
      <main className="flex-1 overflow-y-auto bg-background pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
