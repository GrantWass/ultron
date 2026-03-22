'use client'

import { useEffect, useState } from 'react'
import { useCompletion } from 'ai/react'
import { X, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { UpgradeModal } from './upgrade-modal'

interface TrendsDrawerProps {
  projectId: string
  onClose: () => void
  cachedAnalysis?: string | null
  onAnalysisComplete: (text: string) => void
}

// ── Minimal markdown renderer for structured trend output ─────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function TrendsMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        if (!line.trim()) return null

        const h3 = line.match(/^###\s+(.+)/)
        if (h3) return (
          <h3 key={i} className="text-sm font-semibold text-foreground flex items-center gap-2 pt-2 first:pt-0">
            <span className="h-px flex-1 bg-border" />
            {h3[1]}
            <span className="h-px flex-1 bg-border" />
          </h3>
        )

        const h2 = line.match(/^##\s+(.+)/)
        if (h2) return <h2 key={i} className="text-sm font-semibold text-foreground">{h2[1]}</h2>

        const bullet = line.match(/^[-*]\s+(.+)/)
        if (bullet) return (
          <div key={i} className="flex gap-2 text-sm text-foreground/80 pl-1">
            <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
            <span>{renderInline(bullet[1])}</span>
          </div>
        )

        const numbered = line.match(/^(\d+\.)\s+(.+)/)
        if (numbered) return (
          <div key={i} className="flex gap-2 text-sm text-foreground/80 pl-1">
            <span className="text-muted-foreground shrink-0">{numbered[1]}</span>
            <span>{renderInline(numbered[2])}</span>
          </div>
        )

        return <p key={i} className="text-sm text-foreground/80 leading-relaxed">{renderInline(line)}</p>
      })}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendsDrawer({ projectId, onClose, cachedAnalysis, onAnalysisComplete }: TrendsDrawerProps) {
  const [aiLimitHit, setAiLimitHit] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/trends',
    onFinish: (_prompt, text) => onAnalysisComplete(text),
    onResponse: (response) => {
      if (response.status === 429) setAiLimitHit(true)
    },
  })

  useEffect(() => {
    if (!cachedAnalysis) {
      complete('', { body: { project_id: projectId } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleReanalyze() {
    complete('', { body: { project_id: projectId } })
  }

  const displayText = completion || cachedAnalysis

  return (
    <>
      {showUpgradeModal && <UpgradeModal reason="ai" onClose={() => setShowUpgradeModal(false)} />}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">AI Trends Analysis</h2>
            <span className="text-xs text-muted-foreground">last 50 events</span>
          </div>
          <div className="flex items-center gap-2">
            {displayText && !isLoading && (
              <button
                onClick={handleReanalyze}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Re-analyze
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && !displayText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing recent events…
            </div>
          )}

          {aiLimitHit && (
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
              <p className="text-sm font-medium">Weekly AI limit reached</p>
              <p className="text-xs text-muted-foreground">You&apos;ve used all your AI suggestions for this week. Upgrade to Pro for 500 suggestions per week.</p>
              <button onClick={() => setShowUpgradeModal(true)} className="text-xs text-primary hover:underline">
                Upgrade to Pro →
              </button>
            </div>
          )}

          {error && !displayText && !aiLimitHit && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                {error.message === 'No events to analyze yet'
                  ? 'No events captured yet — check back once your project starts receiving traffic.'
                  : 'Failed to generate analysis. Please try again.'}
              </p>
              {error.message !== 'No events to analyze yet' && (
                <button
                  onClick={handleReanalyze}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try again
                </button>
              )}
            </div>
          )}

          {displayText && (
            <div className="space-y-1">
              {isLoading && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating…
                </div>
              )}
              <TrendsMarkdown text={displayText} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
