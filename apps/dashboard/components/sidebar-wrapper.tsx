'use client'

import { useState } from 'react'
import { Menu, Zap } from 'lucide-react'
import { Sidebar } from './sidebar'
import type { ProjectWithOwnerFlag } from '@ultron/types'
import type { UsageData } from '@/app/dashboard/layout'

interface PendingInvite {
  token: string
  projectId: string
  projectName: string
}

interface SidebarWrapperProps {
  projects: ProjectWithOwnerFlag[]
  pendingInvites?: PendingInvite[]
  usage?: UsageData
}

export function SidebarWrapper({ projects, pendingInvites, usage }: SidebarWrapperProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Ultron</span>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        projects={projects}
        pendingInvites={pendingInvites}
        usage={usage}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
