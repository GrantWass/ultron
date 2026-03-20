'use client'
// TEMPORARY: delete this file when done testing
import { useEffect } from 'react'

export function TestError() {
  useEffect(() => {
    const t = setTimeout(() => {
      throw new Error('Test error — remove me')
    }, 1000)
    return () => clearTimeout(t)
  }, [])
  return null
}
