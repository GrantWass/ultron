import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (projects && projects.length > 0) {
    redirect(`/dashboard/projects/${projects[0].id}`)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <h1 className="text-2xl font-bold">Welcome to Ultron</h1>
      <p className="text-muted-foreground max-w-sm">
        Create your first project to start tracking errors and getting AI-powered fix suggestions.
      </p>
      <Link
        href="/dashboard/projects"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Create a project
      </Link>
    </div>
  )
}
