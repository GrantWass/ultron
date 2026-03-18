'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export function Tip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  function show() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2,
      })
    }
    setVisible(true)
  }

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      className="inline-flex items-center cursor-help shrink-0"
    >
      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] w-64 rounded-md border border-border bg-neutral-900 dark:bg-neutral-800 px-3 py-2 text-xs text-white shadow-lg pointer-events-none leading-relaxed -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top - 8, left: pos.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}
