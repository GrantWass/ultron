'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { Project, GithubConnection } from '@ultron/types'
import { Key, Github, Copy, Check, ExternalLink, Code2, Users, Trash2, Mail, Search, Lock, RefreshCw } from 'lucide-react'
import type { ProjectMember } from '@ultron/types'

// ── SDK Setup ─────────────────────────────────────────────────────────────────

type Framework = 'nextjs' | 'react' | 'vue' | 'sveltekit' | 'vanilla'

const FRAMEWORKS: { value: Framework; label: string }[] = [
  { value: 'nextjs',    label: 'Next.js' },
  { value: 'react',     label: 'React' },
  { value: 'vue',       label: 'Vue 3' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'vanilla',   label: 'Vanilla JS' },
]

function getSnippet(fw: Framework, apiKey: string): string {
  const pkg = 'npm install @ultron-dev/tracker'
  switch (fw) {
    case 'nextjs': return `${pkg}

// components/ultron.tsx
'use client'
import { useEffect } from 'react'
import { initTracker } from '@ultron-dev/tracker'

export function Ultron() {
  useEffect(() => {
    initTracker({
      apiKey: '${apiKey}',
      debug: process.env.NODE_ENV === 'development',
    })
  }, [])
  return null
}

// app/layout.tsx  — add <Ultron /> inside <body>
import { Ultron } from '@/components/ultron'`

    case 'react': return `${pkg}

// main.tsx
import { initTracker } from '@ultron-dev/tracker'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

initTracker({
  apiKey: '${apiKey}',
  debug: import.meta.env.DEV,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)`

    case 'vue': return `${pkg}

// main.ts
import { createApp } from 'vue'
import { initTracker } from '@ultron-dev/tracker'
import App from './App.vue'

initTracker({
  apiKey: '${apiKey}',
  debug: import.meta.env.DEV,
})

createApp(App).mount('#app')`

    case 'sveltekit': return `${pkg}

// src/hooks.client.ts
import { initTracker } from '@ultron-dev/tracker'
import { PUBLIC_ULTRON_API_KEY } from '$env/static/public'

initTracker({
  apiKey: PUBLIC_ULTRON_API_KEY,
  debug: import.meta.env.DEV,
})

// .env
PUBLIC_ULTRON_API_KEY=${apiKey}`

    case 'vanilla': return `<script type="module">
  import { initTracker } from 'https://cdn.jsdelivr.net/npm/@ultron-dev/tracker/dist/index.js'

  initTracker({ apiKey: '${apiKey}' })
</script>`
  }
}

function SdkSetup({ apiKey }: { apiKey: string }) {
  const [framework, setFramework] = useState<Framework>('nextjs')
  const [copied, setCopied] = useState(false)
  const snippet = getSnippet(framework, apiKey)

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-muted/30">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5" />
          SDK Setup
        </h3>
        <div className="flex gap-1 rounded-md border border-border p-1 bg-background">
          {FRAMEWORKS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFramework(value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                framework === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <pre className="text-xs font-mono bg-background p-4 overflow-x-auto leading-relaxed">
          {snippet}
        </pre>
        <button
          onClick={copySnippet}
          className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

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
  const [repos, setRepos] = useState<{ full_name: string; owner: string; name: string; private: boolean }[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')

  // Team
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
    const selectedProject = projects.find((p) => p.id === selectedProjectId)
    if (!(selectedProject as any)?.is_owner) return
    fetch(`/api/projects/${selectedProjectId}/members`)
      .then((r) => r.ok ? r.json() : [])
      .then(setMembers)
  }, [selectedProjectId, projects])

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjectId || !inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setMembers((prev) => [data, ...prev])
      setInviteEmail('')
      setInviteMsg({ type: 'ok', text: `Invite sent to ${data.invited_email}` })
    } else {
      setInviteMsg({ type: 'err', text: data.error ?? 'Failed to send invite' })
    }
    setInviting(false)
  }

  async function removeMember(memberId: string) {
    if (!selectedProjectId) return
    await fetch(`/api/projects/${selectedProjectId}/members/${memberId}`, { method: 'DELETE' })
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

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

  useEffect(() => {
    if (!selectedProjectId || !connection) return
    setReposLoading(true)
    fetch(`/api/github/repos?project_id=${selectedProjectId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setRepos(data); setReposLoading(false) })
      .catch(() => setReposLoading(false))
  }, [selectedProjectId, connection])

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
          <SdkSetup apiKey={selectedProject.api_key} />
        </div>
      )}

      {/* Team — owner only */}
      {(selectedProject as any)?.is_owner && selectedProjectId && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </h2>
          <p className="text-xs text-muted-foreground">
            Invite collaborators to view <span className="font-medium text-foreground">{selectedProject?.name}</span>&apos;s error logs.
          </p>

          {/* Invite form */}
          <form onSubmit={inviteMember} className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteMsg(null) }}
                placeholder="colleague@example.com"
                className="w-full pl-8 pr-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </form>

          {inviteMsg && (
            <p className={`text-xs ${inviteMsg.type === 'ok' ? 'text-green-600' : 'text-destructive'}`}>
              {inviteMsg.text}
            </p>
          )}

          {/* Member list */}
          {members.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-3 py-2.5 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm">{member.invited_email}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      member.status === 'accepted'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {member.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
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

            {/* Repo picker */}
            <form onSubmit={saveRepo} className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Repository</label>
                  {reposLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                {repos.length > 0 ? (
                  <div className="space-y-1.5">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Search repos…"
                        className="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    {/* List */}
                    <div className="rounded-md border border-border overflow-hidden max-h-52 overflow-y-auto">
                      {repos
                        .filter((r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))
                        .map((r) => {
                          const selected = r.owner === repoOwner && r.name === repoName
                          return (
                            <button
                              key={r.full_name}
                              type="button"
                              onClick={() => { setRepoOwner(r.owner); setRepoName(r.name) }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-0 transition-colors text-left
                                ${selected ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted/50 text-foreground'}`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{r.full_name}</span>
                              </span>
                              <span className="flex items-center gap-1.5 shrink-0 ml-2">
                                {r.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                              </span>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ) : !reposLoading ? (
                  /* Fallback: manual entry if repos couldn't load */
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="owner"
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <input
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="repo-name"
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                ) : null}

                {(repoOwner && repoName) && (
                  <p className="text-xs text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{repoOwner}/{repoName}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingRepo || !repoOwner || !repoName}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingRepo ? 'Saving…' : 'Save'}
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
