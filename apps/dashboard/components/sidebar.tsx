'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ProjectWithOwnerFlag } from '@ultron/types'
import { AlertCircle, FolderOpen, Settings, Zap, Users, Mail, SlidersHorizontal, BarChart2 } from 'lucide-react'
import React from 'react'

interface PendingInvite {
  token: string
  projectId: string
  projectName: string
}

interface SidebarProps {
  projects: ProjectWithOwnerFlag[]
  currentProjectId?: string
  pendingInvites?: PendingInvite[]
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ projects, currentProjectId, pendingInvites, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  // Derive current project id from URL if not passed explicitly
  const projectIdMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/)
  const activeProjectId = currentProjectId ?? projectIdMatch?.[1]

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-border bg-card transition-transform duration-200',
        'md:relative md:z-auto md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
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
          <React.Fragment key={project.id}>
            <Link
              href={`/dashboard/projects/${project.id}`}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                activeProjectId === project.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {project.is_owner === false
                ? <Users className="h-3.5 w-3.5 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{project.name}</span>
            </Link>

            {activeProjectId === project.id && (
              <>
                <Link
                  href={`/dashboard/projects/${project.id}/analytics`}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md pl-5 pr-2 py-1 text-xs transition-colors ml-1 border-l-2',
                    pathname === `/dashboard/projects/${project.id}/analytics`
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-primary/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/60'
                  )}
                >
                  <BarChart2 className="h-3 w-3 shrink-0" />
                  <span>Analytics</span>
                </Link>
                <Link
                  href={`/dashboard/projects/${project.id}/settings`}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md pl-5 pr-2 py-1 text-xs transition-colors ml-1 border-l-2',
                    pathname === `/dashboard/projects/${project.id}/settings`
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-primary/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/60'
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3 shrink-0" />
                  <span>Settings</span>
                </Link>
              </>
            )}
          </React.Fragment>
        ))}

        {/* Pending invites */}
        {pendingInvites && pendingInvites.length > 0 && (
          <>
            <p className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Invites
            </p>
            {pendingInvites.map((invite) => (
              <Link
                key={invite.token}
                href={`/invite/${invite.token}`}
                onClick={onClose}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-yellow-600 dark:text-yellow-400 hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{invite.projectName}</span>
                <span className="ml-auto text-[10px] font-medium rounded-full bg-yellow-500/15 px-1.5 py-0.5 shrink-0">
                  Accept
                </span>
              </Link>
            ))}
          </>
        )}

        <Link
          href="/dashboard/projects"
          onClick={onClose}
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
            onClick={onClose}
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
    </aside>
  )
}
