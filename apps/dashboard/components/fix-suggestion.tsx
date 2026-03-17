'use client'

import { useState } from 'react'
import { useCompletion } from 'ai/react'
import { Wand2, Loader2, Github, Info, RefreshCw } from 'lucide-react'

interface FixSuggestionProps {
  errorId: string
  existingSuggestion?: string | null
  githubRepo?: string | null
}

// ── Markdown + diff renderer ──────────────────────────────────────────────────

function DiffBlock({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <div className="rounded-md border border-border overflow-hidden text-xs font-mono">
      {lines.map((line, i) => {
        let bg = 'bg-background'
        let fg = 'text-foreground/80'
        let prefix = ''
        if (line.startsWith('+++') || line.startsWith('---')) {
          bg = 'bg-muted'; fg = 'text-muted-foreground'; prefix = ''
        } else if (line.startsWith('@@')) {
          bg = 'bg-blue-500/10'; fg = 'text-blue-600 dark:text-blue-400'
        } else if (line.startsWith('+')) {
          bg = 'bg-green-500/10'; fg = 'text-green-700 dark:text-green-400'
          prefix = '+'
        } else if (line.startsWith('-')) {
          bg = 'bg-red-500/10'; fg = 'text-red-700 dark:text-red-400'
          prefix = '-'
        }
        return (
          <div key={i} className={`px-4 py-0.5 leading-5 whitespace-pre ${bg} ${fg}`}>
            {prefix ? line : line}
          </div>
        )
      })}
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const isDiff = lang === 'diff' || lang === 'patch' ||
    (code.split('\n').some((l) => l.startsWith('@@')) &&
     code.split('\n').some((l) => l.startsWith('+') || l.startsWith('-')))
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

export function FixSuggestion({ errorId, existingSuggestion, githubRepo }: FixSuggestionProps) {
  const [showFix, setShowFix] = useState(!!existingSuggestion)

  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/fix',
  })

  async function handleSuggestFix() {
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
              <a href="/dashboard/settings" className="underline hover:text-foreground transition-colors">
                Connect in Settings.
              </a>
            </span>
          </div>
        )}

        {displayText && !isLoading && (
          <button
            onClick={handleSuggestFix}
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
