'use client'

import { useState } from 'react'
import { useCompletion } from 'ai/react'
import { Wand2, Loader2, Github, Info } from 'lucide-react'

interface FixSuggestionProps {
  errorId: string
  existingSuggestion?: string | null
  githubRepo?: string | null
}

export function FixSuggestion({ errorId, existingSuggestion, githubRepo }: FixSuggestionProps) {
  const [showFix, setShowFix] = useState(!!existingSuggestion)

  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/fix',
  })

  async function handleSuggestFix() {
    setShowFix(true)
    await complete('', {
      body: { error_id: errorId },
    })
  }

  const displayText = completion || existingSuggestion

  return (
    <div className="space-y-4">
      {/* GitHub context indicator */}
      {githubRepo ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Github className="h-3.5 w-3.5 shrink-0" />
          <span>Using source files from <span className="font-medium text-foreground">{githubRepo}</span></span>
          <span title="The AI will fetch relevant source files from this repo based on the stack trace to give more accurate fix suggestions." className="cursor-help">
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>No GitHub repo connected — AI will infer from the stack trace only. <a href="/dashboard/settings" className="underline hover:text-foreground transition-colors">Connect in Settings.</a></span>
        </div>
      )}

      {!showFix && (
        <button
          onClick={handleSuggestFix}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          Suggest Fix with AI
        </button>
      )}

      {showFix && !displayText && !isLoading && !completion && (
        <button
          onClick={handleSuggestFix}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          Suggest Fix with AI
        </button>
      )}

      {isLoading && !displayText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing error and generating fix suggestion...
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to generate suggestion. Please try again.
        </p>
      )}

      {displayText && (
        <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-sm font-medium">AI Fix Suggestion</span>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating...
              </div>
            )}
            {existingSuggestion && !isLoading && (
              <button
                onClick={handleSuggestFix}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Regenerate
              </button>
            )}
          </div>
          <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {displayText}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
