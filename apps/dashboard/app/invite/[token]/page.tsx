import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import AcceptButton from './accept-button'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — send to login/signup with return URL
  if (!user) {
    redirect(`/login?next=/invite/${token}`)
  }

  // Fetch invite using service role (public lookup by token)
  const serviceClient = createServiceRoleClient()
  const { data: invite } = await serviceClient
    .from('project_members')
    .select('id, invited_email, status, project_id, projects(name)')
    .eq('token', token)
    .single()

  // Invalid token
  if (!invite) {
    return (
      <Layout>
        <XCircle className="h-10 w-10 text-destructive mx-auto" />
        <h1 className="text-xl font-semibold text-center mt-3">Invalid invite</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          This invite link is invalid or has expired.
        </p>
        <Link href="/dashboard" className="block mt-4 text-sm text-primary hover:underline text-center">
          Go to dashboard
        </Link>
      </Layout>
    )
  }

  // Already accepted
  if (invite.status === 'accepted') {
    return (
      <Layout>
        <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
        <h1 className="text-xl font-semibold text-center mt-3">Already accepted</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          This invite has already been used.
        </p>
        <Link
          href={`/dashboard/projects/${invite.project_id}`}
          className="block mt-4 text-sm text-primary hover:underline text-center"
        >
          Go to project
        </Link>
      </Layout>
    )
  }

  // Wrong account
  if (user.email !== invite.invited_email) {
    return (
      <Layout>
        <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto" />
        <h1 className="text-xl font-semibold text-center mt-3">Wrong account</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          This invite was sent to <strong>{invite.invited_email}</strong> but you&apos;re signed in as{' '}
          <strong>{user.email}</strong>.
        </p>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Sign out and sign in with the invited email to continue.
        </p>
      </Layout>
    )
  }

  const projectName = (invite.projects as { name: string } | null)?.name ?? 'a project'

  return (
    <Layout>
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Zap className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-xl font-semibold text-center mt-4">You&apos;ve been invited</h1>
      <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
        You&apos;ve been invited to view error logs for <strong>{projectName}</strong>.
      </p>
      <AcceptButton token={token} projectId={invite.project_id} />
    </Layout>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Ultron</span>
        </div>
        {children}
      </div>
    </div>
  )
}
