'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { Project, GithubConnection } from '@ultron/types'
import { Key, Github, Copy, Check, ExternalLink } from 'lucide-react'

function SettingsContent() {
  const searchParams = useSearchParams()
  const githubConnected = searchParams.get('github_connected')
  const githubError = searchParams.get('error')
  const projectIdParam = searchParams.get('project_id')

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam ?? '')
  const [connection, setConnection] = useState<GithubConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState(false)
  const [repoOwner, setRepoOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [savingRepo, setSavingRepo] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data)
        if (!selectedProjectId && data.length > 0) {
          setSelectedProjectId(data[0].id)
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    fetch(`/api/github/connection?project_id=${selectedProjectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setConnection(data)
          setRepoOwner(data.repo_owner ?? '')
          setRepoName(data.repo_name ?? '')
        } else {
          setConnection(null)
          setRepoOwner('')
          setRepoName('')
        }
      })
  }, [selectedProjectId])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  async function copyApiKey() {
    if (!selectedProject) return
    await navigator.clipboard.writeText(selectedProject.api_key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  async function saveRepo(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjectId) return
    setSavingRepo(true)
    await fetch('/api/github/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: selectedProjectId,
        repo_owner: repoOwner,
        repo_name: repoName,
      }),
    })
    setSavingRepo(false)
  }

  async function disconnectGitHub() {
    if (!selectedProjectId || !confirm('Disconnect GitHub?')) return
    await fetch(`/api/github/connection?project_id=${selectedProjectId}`, { method: 'DELETE' })
    setConnection(null)
    setRepoOwner('')
    setRepoName('')
  }

  if (loading) return <p className="text-muted-foreground text-sm p-6">Loading...</p>

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your API key, GitHub connection, and SDK setup
        </p>
      </div>

      {/* Status messages */}
      {githubConnected && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          GitHub connected successfully!
        </div>
      )}
      {githubError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          GitHub connection failed: {githubError.replace(/_/g, ' ')}
        </div>
      )}

      {/* Project selector */}
      {projects.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* API Key */}
      {selectedProject && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Key
          </h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono">
              {selectedProject.api_key}
            </code>
            <button
              onClick={copyApiKey}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* SDK Install instructions */}
          <div className="rounded-md border border-border p-4 space-y-3 bg-muted/30">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SDK Setup
            </h3>
            <pre className="text-xs font-mono bg-background rounded p-3 border border-border overflow-x-auto">
{`npm install @ultron/tracker

import { initTracker } from '@ultron/tracker'

initTracker({
  apiKey: '${selectedProject.api_key}',
  endpoint: '${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}'
})`}
            </pre>
          </div>
        </div>
      )}

      {/* GitHub Connection */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Github className="h-4 w-4" />
          GitHub Connection
        </h2>
        <p className="text-xs text-muted-foreground">
          Connect a repository to allow Claude to fetch source files and provide better fix suggestions.
        </p>

        {!selectedProjectId ? (
          <p className="text-sm text-muted-foreground">Select a project first.</p>
        ) : connection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Connected
            </div>

            {/* Repo config */}
            <form onSubmit={saveRepo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Owner / Org</label>
                  <input
                    type="text"
                    value={repoOwner}
                    onChange={(e) => setRepoOwner(e.target.value)}
                    placeholder="octocat"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Repository</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-app"
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingRepo}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingRepo ? 'Saving...' : 'Save repository'}
                </button>
                <button
                  type="button"
                  onClick={disconnectGitHub}
                  className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </form>
          </div>
        ) : (
          <a
            href={`/api/github/connect?project_id=${selectedProjectId}`}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            <Github className="h-4 w-4" />
            Connect GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
