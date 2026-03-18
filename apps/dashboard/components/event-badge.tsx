import { cn } from '@/lib/utils'
import type { EventType } from '@ultron/types'

const CONFIG: Record<EventType, { label: string; className: string }> = {
  error:          { label: 'Error',     className: 'bg-red-100 text-red-700 border-red-200' },
  network:        { label: 'Network',   className: 'bg-orange-100 text-orange-700 border-orange-200' },
  vital:          { label: 'Vital',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  resource_error: { label: 'Resource',  className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

const CATEGORY_CONFIG: Record<string, { className: string; label: string }> = {
  cors:            { className: 'bg-purple-100 text-purple-700 border-purple-200', label: 'CORS' },
  server_error:    { className: 'bg-red-100 text-red-700 border-red-200',          label: 'Server Error' },
  client_error:    { className: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Client Error' },
  slow:            { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Slow' },
  network_failure: { className: 'bg-gray-100 text-gray-700 border-gray-200',       label: 'Network Failure' },
}

const RATING_CONFIG: Record<string, { className: string; label: string }> = {
  good:                { className: 'bg-green-100 text-green-700 border-green-200',   label: 'Good' },
  'needs-improvement': { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Needs Improvement' },
  poor:                { className: 'bg-red-100 text-red-700 border-red-200',          label: 'Poor' },
}

interface BadgeProps {
  className?: string
  children: React.ReactNode
  variant?: string
}

function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border',
      className
    )}>
      {children}
    </span>
  )
}

export function EventTypeBadge({ type }: { type: EventType }) {
  const cfg = CONFIG[type] ?? CONFIG.error
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category]
  return <Badge className={cfg?.className ?? 'bg-gray-100 text-gray-700 border-gray-200'}>{cfg?.label ?? category}</Badge>
}

export function VitalRatingBadge({ rating }: { rating: string }) {
  const cfg = RATING_CONFIG[rating]
  return <Badge className={cfg?.className ?? 'bg-gray-100 text-gray-700 border-gray-200'}>{cfg?.label ?? rating}</Badge>
}
