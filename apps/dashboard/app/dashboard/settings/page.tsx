'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@ultron/types'
import {
  Key, Github, Copy, Check, ExternalLink, Code2, ChevronDown, LogOut,
} from 'lucide-react'

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

function SdkSetup({ apiKey, framework }: { apiKey: string; framework: Framework }) {
  const [copied, setCopied] = useState(false)
  const snippet = getSnippet(framework, apiKey)

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
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
  )
}

function SdkSetupCollapsible({ apiKey }: { apiKey: string }) {
  const [open, setOpen] = useState(true)
  const [framework, setFramework] = useState<Framework>('nextjs')
  return (
    <div className="rounded-md border border-border overflow-hidden bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            SDK Setup
          </h3>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
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
      {open && <SdkSetup apiKey={apiKey} framework={framework} />}
    </div>
  )
}

// ── Main settings content ──────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const projectIdParam = searchParams.get('project_id')
  const githubConnected = searchParams.get('github_connected')
  const githubError = searchParams.get('error')

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam ?? '')
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState(false)
  const [ghLoading, setGhLoading] = useState(true)
  const [ghConnected, setGhConnected] = useState(false)
  const [ghUsername, setGhUsername] = useState('')

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
    fetch('/api/github/user-connection')
      .then((r) => r.ok ? r.json() : { connected: false })
      .then((data) => {
        setGhConnected(data.connected)
        setGhUsername(data.github_username ?? '')
        setGhLoading(false)
      })
  }, [])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  async function copyApiKey() {
    if (!selectedProject) return
    await navigator.clipboard.writeText(selectedProject.api_key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  async function disconnectGitHub() {
    if (!confirm('Disconnect GitHub? This will remove your connection but keep project repo selections.')) return
    await fetch('/api/github/user-connection', { method: 'DELETE' })
    setGhConnected(false)
    setGhUsername('')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return <p className="text-muted-foreground text-sm p-6">Loading...</p>

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          SDK setup, GitHub connection, and account options
        </p>
      </div>

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

      {/* API Key + SDK Setup */}
      {selectedProject && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Key
          </h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono truncate">
              {selectedProject.api_key}
            </code>
            <button
              onClick={copyApiKey}
              className="shrink-0 flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <SdkSetupCollapsible apiKey={selectedProject.api_key} />
        </div>
      )}

      {/* GitHub Connection */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Github className="h-4 w-4" />
          GitHub Connection
        </h2>
        <p className="text-xs text-muted-foreground">
          Connect GitHub once — then select a repository per project in Project Settings.
        </p>
        {githubConnected && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300">
            GitHub connected successfully!
          </div>
        )}
        {githubError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            GitHub connection failed: {githubError.replace(/_/g, ' ')}
          </div>
        )}
        {ghLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : ghConnected ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              Connected{ghUsername ? ` as ${ghUsername}` : ''}
            </div>
            <button
              onClick={disconnectGitHub}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href="/api/github/connect"
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            <Github className="h-4 w-4" />
            Connect GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Sign out */}
      <div className="border-t border-border pt-6">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
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
