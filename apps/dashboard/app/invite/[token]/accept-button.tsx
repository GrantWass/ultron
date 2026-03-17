'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptButton({ token, projectId }: { token: string; projectId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept invite')
      } else {
        router.push(`/dashboard/projects/${projectId}`)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        onClick={accept}
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Accepting…' : 'Accept invitation'}
      </button>
    </div>
  )
}
