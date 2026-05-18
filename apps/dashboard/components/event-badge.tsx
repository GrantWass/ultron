import { cn } from '@/lib/utils'
import type { EventType } from '@ultron/types'

const CONFIG: Record<EventType, { label: string; className: string; description: string }> = {
  error:          { label: 'Error',    className: 'bg-red-100 text-red-700 border-red-200',           description: 'Unhandled JavaScript exception' },
  network:        { label: 'Network',  className: 'bg-orange-100 text-orange-700 border-orange-200',  description: 'Failed fetch or XHR request' },
  vital:          { label: 'Vital',    className: 'bg-blue-100 text-blue-700 border-blue-200',        description: 'Web Core Vital measurement (LCP, CLS, INP, etc.)' },
  resource_error: { label: 'Resource', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', description: 'Failed to load a script, stylesheet, or image' },
}

const CATEGORY_CONFIG: Record<string, { className: string; label: string; description: string }> = {
  cors:            { className: 'bg-purple-100 text-purple-700 border-purple-200', label: 'CORS',           description: 'Cross-origin request blocked — server is missing Access-Control headers' },
  server_error:    { className: 'bg-red-100 text-red-700 border-red-200',          label: 'Server Error',   description: 'Server returned a 5xx status code' },
  client_error:    { className: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Client Error',   description: 'Server returned a 4xx status code (401, 403, 404, etc.)' },
  slow:            { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Slow',           description: 'Request succeeded but exceeded the slow-request threshold' },
  network_failure: { className: 'bg-gray-100 text-gray-700 border-gray-200',       label: 'Network Failure', description: 'Request never received a response (timeout, offline, or connection refused)' },
}

const RATING_CONFIG: Record<string, { className: string; label: string; description: string }> = {
  good:                { className: 'bg-green-100 text-green-700 border-green-200',    label: 'Good',              description: 'Vital is within the good threshold' },
  'needs-improvement': { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Needs Improvement', description: 'Vital exceeds the good threshold but is not yet poor' },
  poor:                { className: 'bg-red-100 text-red-700 border-red-200',          label: 'Poor',              description: 'Vital exceeds the poor threshold — likely impacting users' },
}

interface BadgeProps {
  className?: string
  children: React.ReactNode
  title?: string
}

function Badge({ children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border',
        title && 'cursor-help',
        className
      )}
    >
      {children}
    </span>
  )
}

export function EventTypeBadge({ type }: { type: EventType }) {
  const cfg = CONFIG[type] ?? CONFIG.error
  return <Badge className={cfg.className} title={cfg.description}>{cfg.label}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_CONFIG[category]
  return (
    <Badge className={cfg?.className ?? 'bg-gray-100 text-gray-700 border-gray-200'} title={cfg?.description}>
      {cfg?.label ?? category}
    </Badge>
  )
}

export function VitalRatingBadge({ rating }: { rating: string }) {
  const cfg = RATING_CONFIG[rating]
  return (
    <Badge className={cfg?.className ?? 'bg-gray-100 text-gray-700 border-gray-200'} title={cfg?.description}>
      {cfg?.label ?? rating}
    </Badge>
  )
}
