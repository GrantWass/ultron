'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Project } from '@ultron/types'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, Key, AlertCircle, GitBranch, UserCheck } from 'lucide-react'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function fetchProjects() {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data)
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })

    if (res.ok) {
      setNewName('')
      setShowCreate(false)
      fetchProjects()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create project')
    }
    setCreating(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This will also delete all errors.`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    fetchProjects()
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each project has its own API key for error ingestion
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-md border border-border p-4 space-y-3">
          <h2 className="text-sm font-medium">Create new project</h2>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="My App"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(null) }}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Owned projects */}
          {projects.some((p: any) => p.is_owner !== false) && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">My Projects</p>
              {projects.filter((p: any) => p.is_owner !== false).map((project: any) => (
                <div key={project.id} className="rounded-md border border-border p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/dashboard/projects/${project.id}`} className="font-medium hover:text-primary transition-colors">
                        {project.name}
                      </Link>
                      {project.has_github_connection && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                          <GitBranch className="h-2.5 w-2.5" />
                          GitHub
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(project.created_at)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Key className="h-3 w-3 text-muted-foreground" />
                      <code className="text-xs font-mono text-muted-foreground">{project.api_key}</code>
                      <button onClick={() => copyKey(project.api_key)} className="text-xs text-primary hover:underline">
                        {copiedKey === project.api_key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(project.id, project.name)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Delete project">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Shared projects */}
          {projects.some((p: any) => p.is_owner === false) && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shared with me</p>
              {projects.filter((p: any) => p.is_owner === false).map((project: any) => (
                <div key={project.id} className="rounded-md border border-border p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/dashboard/projects/${project.id}`} className="font-medium hover:text-primary transition-colors">
                        {project.name}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                        <UserCheck className="h-2.5 w-2.5" />
                        Collaborator
                      </span>
                      {project.has_github_connection && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                          <GitBranch className="h-2.5 w-2.5" />
                          GitHub
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Created {formatDate(project.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
