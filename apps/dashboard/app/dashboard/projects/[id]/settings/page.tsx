'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { ProjectMember } from '@ultron/types'
import {
  Github, Check, Code2, Users, Trash2, Mail,
  Search, Lock, RefreshCw, Settings, ExternalLink,
} from 'lucide-react'

// ── GitHub repo section ────────────────────────────────────────────────────────

interface GitHubSectionProps {
  projectId: string
  searchParams: ReturnType<typeof useSearchParams>
  isOwner: boolean | null
}

function GitHubSection({ projectId, searchParams, isOwner }: GitHubSectionProps) {
  const githubConnected = searchParams.get('github_connected')
  const githubError = searchParams.get('error')

  const [connection, setConnection] = useState<{ user_connected: boolean; repo_owner?: string | null; repo_name?: string | null } | null>(null)
  const [connLoading, setConnLoading] = useState(true)
  const [repoOwner, setRepoOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [savingRepo, setSavingRepo] = useState(false)
  const [repos, setRepos] = useState<{ full_name: string; owner: string; name: string; private: boolean }[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [editingRepo, setEditingRepo] = useState(false)

  useEffect(() => {
    fetch(`/api/github/connection?project_id=${projectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setConnection(data)
        if (data?.user_connected && data.repo_owner && data.repo_name) {
          setRepoOwner(data.repo_owner)
          setRepoName(data.repo_name)
          setEditingRepo(false)
        } else if (data?.user_connected) {
          setEditingRepo(true)
        }
        setConnLoading(false)
      })
  }, [projectId])

  useEffect(() => {
    if (!connection?.user_connected || isOwner === false) return
    setReposLoading(true)
    fetch(`/api/github/repos?project_id=${projectId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setRepos(data); setReposLoading(false) })
      .catch(() => setReposLoading(false))
  }, [projectId, connection, isOwner])

  async function saveRepo(e: React.FormEvent) {
    e.preventDefault()
    setSavingRepo(true)
    const res = await fetch('/api/github/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, repo_owner: repoOwner, repo_name: repoName }),
    })
    setSavingRepo(false)
    if (res.ok) {
      setConnection((prev) => prev ? { ...prev, repo_owner: repoOwner, repo_name: repoName } : prev)
      setEditingRepo(false)
    }
  }

  async function disconnectGitHub() {
    if (!confirm('Disconnect GitHub?')) return
    await fetch(`/api/github/connection?project_id=${projectId}`, { method: 'DELETE' })
    setConnection(null)
    setRepoOwner('')
    setRepoName('')
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Github className="h-4 w-4" />
        GitHub Repository
      </h2>
      <p className="text-xs text-muted-foreground">
        Connect a repository to allow Claude to fetch source files and provide better fix suggestions.
      </p>

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

      {connLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : connection ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" />
            Connected
            {isOwner === false && (
              <span
                title="Only the project owner can manage the GitHub connection"
                className="ml-1 text-xs text-muted-foreground cursor-help"
              >
                (read-only)
              </span>
            )}
          </div>

          {!editingRepo && connection?.repo_owner && connection?.repo_name ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Code2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{connection.repo_owner}/{connection.repo_name}</span>
              </div>
              {isOwner !== false && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRepo(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={disconnectGitHub}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : isOwner === false ? null : (
            <form onSubmit={saveRepo} className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Repository</label>
                  {reposLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                {repos.length > 0 ? (
                  <div className="space-y-1.5">
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
                              <span className="truncate">{r.full_name}</span>
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
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingRepo || !repoOwner || !repoName}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingRepo ? 'Saving…' : 'Save'}
                </button>
                {connection?.repo_owner && (
                  <button
                    type="button"
                    onClick={() => {
                      setRepoOwner(connection.repo_owner ?? '')
                      setRepoName(connection.repo_name ?? '')
                      setEditingRepo(false)
                    }}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={disconnectGitHub}
                  className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </form>
          )}
        </div>
      ) : isOwner === false ? (
        <p
          className="text-sm text-muted-foreground cursor-help"
          title="Only the project owner can connect a GitHub repository"
        >
          No GitHub repository connected.
        </p>
      ) : (
        <a
          href={`/api/github/connect?project_id=${projectId}`}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
        >
          <Github className="h-4 w-4" />
          Connect GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

// ── Team section ───────────────────────────────────────────────────────────────

function TeamSection({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.ok ? r.json() : [])
      .then(setMembers)
  }, [projectId])

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const res = await fetch(`/api/projects/${projectId}/members`, {
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
    await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" />
        Team
      </h2>
      <p className="text-xs text-muted-foreground">
        Invite collaborators to view this project&apos;s error logs.
      </p>

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
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

function ProjectSettingsContent({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const [projectName, setProjectName] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((projects: any[]) => {
        const project = projects.find((p) => p.id === projectId)
        if (project) {
          setProjectName(project.name)
          setIsOwner(project.is_owner !== false)
        }
      })
  }, [projectId])

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-8">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Project Settings</h1>
          {projectName && (
            <p className="text-sm text-muted-foreground mt-0.5">{projectName}</p>
          )}
        </div>
      </div>

      {isOwner && <TeamSection projectId={projectId} />}

      <GitHubSection projectId={projectId} searchParams={searchParams} isOwner={isOwner} />
    </div>
  )
}

export default function ProjectSettingsPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading…</div>}>
      <ProjectSettingsContent projectId={id} />
    </Suspense>
  )
}
