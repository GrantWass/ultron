export type Plan = 'free' | 'pro'

export const LIMITS = {
  free: {
    events_per_month:            5_000,
    ai_per_week:                 5,
    collaborators_per_project:   1,
    projects:                    3,
    retention_days:              30,
  },
  pro: {
    events_per_month:            500_000,
    ai_per_week:                 500,
    collaborators_per_project:   Infinity,
    projects:                    Infinity,
    retention_days:              90,
  },
} as const

export type LimitKey = keyof typeof LIMITS.free

export function getLimit(plan: Plan, key: LimitKey): number {
  return LIMITS[plan][key] as number
}

export function isPro(plan: Plan): boolean {
  return plan === 'pro'
}

/** Returns true if the billing cycle (monthly) has rolled over */
export function isBillingCycleExpired(cycleStart: string | null | undefined): boolean {
  if (!cycleStart) return true
  const start = new Date(cycleStart)
  if (isNaN(start.getTime())) return true
  const now = new Date()
  return start.getFullYear() !== now.getFullYear() || start.getMonth() !== now.getMonth()
}

/** Returns true if the weekly AI counter window (7 days) has elapsed */
export function isWeekExpired(resetAt: string | null | undefined): boolean {
  if (!resetAt) return true
  const reset = new Date(resetAt)
  if (isNaN(reset.getTime())) return true
  const now = new Date()
  return now.getTime() - reset.getTime() > 7 * 24 * 60 * 60 * 1000
}
