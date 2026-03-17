import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ErrorTable } from '@/components/error-table'
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

  const [{ data: project }, { data: allProjects }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('projects').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{(project as Project).name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Error feed — click any error for details and AI fix suggestions
        </p>
      </div>
      <ErrorTable projectId={id} projects={allProjects ?? []} />
    </div>
  )
}
