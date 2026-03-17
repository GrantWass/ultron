'use client'

import { useEffect } from 'react'

export function UltronProvider() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ULTRON_API_KEY
    if (!apiKey) return
    import('@ultron-dev/tracker').then(({ initTracker }) => {
      initTracker({ apiKey })
    })
  }, [])
  return null
}
