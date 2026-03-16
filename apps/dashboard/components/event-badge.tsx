import { cn } from '@/lib/utils'
import type { EventType } from '@ultron/types'

const CONFIG: Record<EventType, { label: string; className: string }> = {
  error:          { label: 'Error',     className: 'bg-red-100 text-red-700 border-red-200' },
  network:        { label: 'Network',   className: 'bg-orange-100 text-orange-700 border-orange-200' },
  vital:          { label: 'Vital',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  resource_error: { label: 'Resource',  className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

const CATEGORY_CONFIG: Record<string, string> = {
  cors:            'bg-purple-100 text-purple-700 border-purple-200',
  server_error:    'bg-red-100 text-red-700 border-red-200',
  client_error:    'bg-orange-100 text-orange-700 border-orange-200',
  slow:            'bg-yellow-100 text-yellow-700 border-yellow-200',
  network_failure: 'bg-gray-100 text-gray-700 border-gray-200',
}

const RATING_CONFIG: Record<string, string> = {
  good:              'bg-green-100 text-green-700 border-green-200',
  'needs-improvement': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  poor:              'bg-red-100 text-red-700 border-red-200',
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
  const className = CATEGORY_CONFIG[category] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return <Badge className={className}>{category.replace('_', ' ')}</Badge>
}

export function VitalRatingBadge({ rating }: { rating: string }) {
  const className = RATING_CONFIG[rating] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return <Badge className={className}>{rating}</Badge>
}
