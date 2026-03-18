'use client'

import { useState } from 'react'
import { useCompletion } from 'ai/react'
import { Wand2, Loader2, Github, Info, RefreshCw } from 'lucide-react'

interface FixSuggestionProps {
  errorId: string
  projectId: string
  existingSuggestion?: string | null
  githubRepo?: string | null
}

// ── Markdown + diff renderer ──────────────────────────────────────────────────

function DiffBlock({ code }: { code: string }) {
  const lines = code.split('\n')

  const fromFile = lines.find((l) => l.startsWith('--- '))?.slice(4).replace(/^a\//, '') ?? null
  const toFile   = lines.find((l) => l.startsWith('+++ '))?.slice(4).replace(/^b\//, '') ?? null
  const fileName = toFile ?? fromFile

  let oldLine = 1
  let newLine = 1

  // Gutter cell shared styles
  const gutter = 'w-12 shrink-0 text-right px-2 py-0.5 select-none tabular-nums leading-5'

  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono bg-[#0d1117] dark:bg-[#0d1117]">
      {/* File header */}
      {fileName && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-[#8b949e]">
          <span className="text-[#e6edf3] font-medium truncate">{fileName}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        {lines.map((line, i) => {
          if (line.startsWith('--- ') || line.startsWith('+++ ')) return null

          // Hunk header
          if (line.startsWith('@@')) {
            const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
            if (m) { oldLine = parseInt(m[1]); newLine = parseInt(m[2]) }
            return (
              <div key={i} className="flex bg-[#1f2d3d] text-[#79c0ff]">
                <span className={`${gutter} text-[#3d5a7a] border-r border-[#30363d]`} />
                <span className={`${gutter} text-[#3d5a7a] border-r border-[#30363d]`} />
                <span className="w-6 shrink-0 border-r border-[#30363d]" />
                <span className="px-4 py-0.5 leading-5 whitespace-pre">{line}</span>
              </div>
            )
          }

          // Added line
          if (line.startsWith('+')) {
            const n = newLine++
            return (
              <div key={i} className="flex bg-[#0f2a1e] border-l-2 border-[#2ea043]">
                <span className={`${gutter} text-[#3a5a3a] border-r border-[#1a3a1a]`} />
                <span className={`${gutter} text-[#4a9a4a] border-r border-[#1a3a1a]`}>{n}</span>
                <span className="w-6 shrink-0 flex items-center justify-center text-[#2ea043] border-r border-[#1a3a1a] select-none">+</span>
                <span className="px-4 py-0.5 leading-5 whitespace-pre text-[#aff5b4]">{line.slice(1)}</span>
              </div>
            )
          }

          // Removed line
          if (line.startsWith('-')) {
            const n = oldLine++
            return (
              <div key={i} className="flex bg-[#2a0f0f] border-l-2 border-[#f85149]">
                <span className={`${gutter} text-[#9a4a4a] border-r border-[#3a1a1a]`}>{n}</span>
                <span className={`${gutter} text-[#5a3a3a] border-r border-[#3a1a1a]`} />
                <span className="w-6 shrink-0 flex items-center justify-center text-[#f85149] border-r border-[#3a1a1a] select-none">−</span>
                <span className="px-4 py-0.5 leading-5 whitespace-pre text-[#ffa198]">{line.slice(1)}</span>
              </div>
            )
          }

          // Context line
          const o = oldLine++; const n = newLine++
          return (
            <div key={i} className="flex border-l-2 border-transparent">
              <span className={`${gutter} text-[#484f58] border-r border-[#30363d]`}>{o || ''}</span>
              <span className={`${gutter} text-[#484f58] border-r border-[#30363d]`}>{n || ''}</span>
              <span className="w-6 shrink-0 border-r border-[#30363d]" />
              <span className="px-4 py-0.5 leading-5 whitespace-pre text-[#8b949e]">{line}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const lines = code.split('\n')
  const changedLines = lines.filter((l) => l.startsWith('+') || l.startsWith('-'))
  const isDiff =
    lang === 'diff' || lang === 'patch' ||
    // Model often skips @@ headers — just require 1+ changed lines
    changedLines.length >= 1
  if (isDiff) return <DiffBlock code={code} />
  return (
    <pre className="rounded-md border border-border bg-muted/50 px-4 py-3 text-xs font-mono overflow-x-auto leading-5 whitespace-pre">
      {code}
    </pre>
  )
}

// Parse markdown into typed segments
type Segment =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'text'; lines: string[] }

function parseMarkdown(raw: string): Segment[] {
  const segments: Segment[] = []
  const lines = raw.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      segments.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++
      continue
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // consume closing ```
      segments.push({ type: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    // Text block — accumulate until next heading or code fence
    const textLines: string[] = []
    while (i < lines.length && !lines[i].match(/^#{1,3}\s/) && !lines[i].startsWith('```')) {
      textLines.push(lines[i])
      i++
    }
    if (textLines.some((l) => l.trim())) {
      segments.push({ type: 'text', lines: textLines })
    }
  }

  return segments
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function MarkdownRenderer({ text }: { text: string }) {
  const segments = parseMarkdown(text)

  return (
    <div className="space-y-4">
      {segments.map((seg, i) => {
        if (seg.type === 'heading') {
          if (seg.level === 1) return <h2 key={i} className="text-base font-semibold text-foreground">{seg.text}</h2>
          if (seg.level === 2) return (
            <h3 key={i} className="text-sm font-semibold text-foreground flex items-center gap-2 pt-1">
              <span className="h-px flex-1 bg-border" />
              {seg.text}
              <span className="h-px flex-1 bg-border" />
            </h3>
          )
          return <h4 key={i} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{seg.text}</h4>
        }

        if (seg.type === 'code') {
          return <CodeBlock key={i} code={seg.code} lang={seg.lang} />
        }

        // Text block
        return (
          <div key={i} className="space-y-1.5">
            {seg.lines.map((line, j) => {
              if (!line.trim()) return null
              // List item
              const listMatch = line.match(/^(\s*[-*]\s+)(.+)/)
              if (listMatch) return (
                <div key={j} className="flex gap-2 text-sm text-foreground/80">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{renderInline(listMatch[2])}</span>
                </div>
              )
              const numberedMatch = line.match(/^(\s*\d+\.\s+)(.+)/)
              if (numberedMatch) return (
                <div key={j} className="flex gap-2 text-sm text-foreground/80">
                  <span className="text-muted-foreground shrink-0">{numberedMatch[1].trim()}</span>
                  <span>{renderInline(numberedMatch[2])}</span>
                </div>
              )
              return <p key={j} className="text-sm text-foreground/80 leading-relaxed">{renderInline(line)}</p>
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FixSuggestion({ errorId, projectId, existingSuggestion, githubRepo }: FixSuggestionProps) {
  const [showFix, setShowFix] = useState(!!existingSuggestion)

  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/fix',
  })

  async function handleSuggestFix() {
    setShowFix(true)
    await complete('', { body: { error_id: errorId } })
  }

  async function handleRegenerate() {
    // Delete cached suggestion so the server generates a fresh one
    await fetch('/api/fix', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_id: errorId }),
    })
    setShowFix(true)
    await complete('', { body: { error_id: errorId } })
  }

  const displayText = completion || existingSuggestion

  return (
    <div className="space-y-4">
      {/* GitHub context badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {githubRepo ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Github className="h-3.5 w-3.5 shrink-0" />
            <span>Source files from <span className="font-medium text-foreground">{githubRepo}</span></span>
            <span className="relative group cursor-help">
              <Info className="h-3.5 w-3.5" />
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Relevant source files are fetched from this repo using the stack trace, giving the AI more accurate context.
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              No GitHub repo connected — AI will infer from the stack trace only.{' '}
              <a href={`/dashboard/projects/${projectId}/settings`} className="underline hover:text-foreground transition-colors">
                Connect in Project Settings.
              </a>
            </span>
          </div>
        )}

        {displayText && !isLoading && (
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </button>
        )}
      </div>

      {/* Loading state (before first token) */}
      {isLoading && !displayText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing error and fetching relevant files…
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">Failed to generate suggestion. Please try again.</p>
      )}

      {/* Trigger button */}
      {!showFix && !isLoading && (
        <button
          onClick={handleSuggestFix}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Wand2 className="h-4 w-4" />
          Suggest Fix with AI
        </button>
      )}

      {showFix && !displayText && !isLoading && (
        <button
          onClick={handleSuggestFix}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Wand2 className="h-4 w-4" />
          Suggest Fix with AI
        </button>
      )}

      {/* Rendered suggestion */}
      {displayText && (
        <div className="rounded-md border border-border overflow-hidden">
          {isLoading && (
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating…
            </div>
          )}
          <div className="p-4">
            <MarkdownRenderer text={displayText} />
          </div>
        </div>
      )}
    </div>
  )
}
