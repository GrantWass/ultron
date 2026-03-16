'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Project } from '@ultron/types'
import { AlertCircle, FolderOpen, Settings, LogOut, Zap } from 'lucide-react'

interface SidebarProps {
  projects: Project[]
  currentProjectId?: string
}

export function Sidebar({ projects, currentProjectId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Ultron</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {/* Projects section */}
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Projects
        </p>

        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              currentProjectId === project.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.name}</span>
          </Link>
        ))}

        <Link
          href="/dashboard/projects"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            pathname === '/dashboard/projects'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span>Manage Projects</span>
        </Link>

        <div className="pt-2 border-t border-border">
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              pathname === '/dashboard/settings'
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      {/* Sign out */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
