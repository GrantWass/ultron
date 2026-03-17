'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

interface ResolveButtonProps {
  projectId: string
  message: string
  eventType: string
}

export function ResolveButton({ projectId, message, eventType }: ResolveButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleResolve() {
    if (!confirm(`Resolve all "${eventType}" errors with this message from this project?\n\nThis will permanently delete all matching errors.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/errors/resolve', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, message, event_type: eventType }),
      })
      if (!res.ok) throw new Error('Failed to resolve')
      const { deleted } = await res.json()
      router.push(`/dashboard/projects/${projectId}`)
    } catch {
      alert('Failed to resolve errors. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleResolve}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-500/15 transition-colors disabled:opacity-50 dark:text-green-400"
    >
      <CheckCircle className="h-3.5 w-3.5" />
      {loading ? 'Resolving…' : 'Resolve all similar'}
    </button>
  )
}
