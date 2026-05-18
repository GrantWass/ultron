'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

function TooltipPortal({ text, pos }: { text: string; pos: { top: number; left: number } }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed z-[9999] max-w-xs rounded-md border border-border bg-neutral-900 dark:bg-neutral-800 px-3 py-2 text-xs text-white shadow-lg pointer-events-none leading-relaxed -translate-x-1/2 -translate-y-full"
      style={{ top: pos.top - 8, left: pos.left }}
    >
      {text}
    </div>,
    document.body
  )
}

function useTooltip() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  function show() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ top: rect.top + window.scrollY, left: rect.left + rect.width / 2 })
    }
    setVisible(true)
  }

  return { ref, visible, pos, show, hide: () => setVisible(false) }
}

// Wraps any trigger element — shows a styled tooltip on hover.
export function Tooltip({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  const { ref, visible, pos, show, hide } = useTooltip()
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className={className ?? 'inline-flex items-center'}>
      {children}
      {visible && <TooltipPortal text={text} pos={pos} />}
    </span>
  )
}

// Inline Info icon with a tooltip on hover.
export function Tip({ text }: { text: string }) {
  const { ref, visible, pos, show, hide } = useTooltip()
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className="inline-flex items-center cursor-help shrink-0">
      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
      {visible && <TooltipPortal text={text} pos={pos} />}
    </span>
  )
}
