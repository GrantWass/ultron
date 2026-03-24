'use client'

import { useState } from 'react'
import { X, Zap, Check } from 'lucide-react'

export type UpgradeReason = 'events' | 'ai' | 'projects' | 'collaborators' | 'upgrade'

const REASON_COPY: Record<UpgradeReason, { title: string; body: string }> = {
  upgrade: {
    title: "Unlock more with Pro",
    body:  "Get 500,000 events/month, 500 AI fix suggestions/week, unlimited projects and collaborators, and 90-day data retention.",
  },
  events: {
    title: "You've used all your events this month",
    body:  "Your free plan includes 5,000 events per month. New events are being dropped until the next billing cycle or you upgrade.",
  },
  ai: {
    title: "You've used all your AI suggestions this week",
    body:  "Your free plan includes 5 AI fix suggestions per week. Upgrade to Pro for 500 suggestions per week.",
  },
  projects: {
    title: "You've reached the project limit",
    body:  "Your free plan allows up to 3 projects. Upgrade to Pro to create unlimited projects.",
  },
  collaborators: {
    title: "You've reached the collaborator limit",
    body:  "Your free plan allows 1 collaborator per project. Upgrade to Pro for unlimited team members.",
  },
}

const PRO_FEATURES = [
  '500,000 events / month',
  '500 AI fix suggestions / week',
  'Unlimited team members',
  'Unlimited projects',
  '90-day data retention',
]

interface UpgradeModalProps {
  reason: UpgradeReason
  onClose: () => void
}

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false)
  const { title, body } = REASON_COPY[reason]

  async function handleUpgrade() {
    setLoading(true)
    const res = await fetch('/api/billing/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="relative w-full max-w-sm rounded-xl border border-border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-0">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Upgrade to Pro</span>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors -mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>

            {/* Features */}
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <Zap className="h-4 w-4" />
              {loading ? 'Redirecting to checkout…' : 'Upgrade to Pro'}
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
