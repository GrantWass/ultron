'use client'

import { useEffect } from 'react'

export function UltronProvider() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ULTRON_API_KEY
    if (!apiKey) {
      console.warn('[Ultron] NEXT_PUBLIC_ULTRON_API_KEY is not set — tracker disabled')
      return
    }
    import('@ultron-dev/tracker')
      .then(({ initTracker }) => {
        initTracker({ apiKey, debug: true })
      })
      .catch((err) => {
        console.warn('[Ultron] Failed to load tracker:', err)
      })
  }, [])
  return null
}
