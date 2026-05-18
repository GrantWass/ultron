import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isBillingCycleExpired, isWeekExpired, getLimit, isPro, LIMITS } from '../plans'

describe('isBillingCycleExpired', () => {
  it('returns false when cycle started this month', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(isBillingCycleExpired(today)).toBe(false)
  })

  it('returns true when cycle started last month', () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    expect(isBillingCycleExpired(lastMonth.toISOString().slice(0, 10))).toBe(true)
  })

  it('returns true when cycle started a year ago', () => {
    const lastYear = new Date()
    lastYear.setFullYear(lastYear.getFullYear() - 1)
    expect(isBillingCycleExpired(lastYear.toISOString().slice(0, 10))).toBe(true)
  })

  it('returns true for null (self-heals on next ingest)', () => {
    expect(isBillingCycleExpired(null)).toBe(true)
  })

  it('returns true for undefined', () => {
    expect(isBillingCycleExpired(undefined)).toBe(true)
  })

  it('returns true for empty string', () => {
    expect(isBillingCycleExpired('')).toBe(true)
  })

  it('returns true for an invalid date string', () => {
    expect(isBillingCycleExpired('not-a-date')).toBe(true)
  })

  it('returns false on the first day of the current month', () => {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    expect(isBillingCycleExpired(firstOfMonth)).toBe(false)
  })
})

describe('isWeekExpired', () => {
  it('returns false when reset was just now', () => {
    expect(isWeekExpired(new Date().toISOString())).toBe(false)
  })

  it('returns false when reset was 6 days ago', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWeekExpired(sixDaysAgo)).toBe(false)
  })

  it('returns true when reset was 8 days ago', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(isWeekExpired(eightDaysAgo)).toBe(true)
  })

  it('returns true for null', () => {
    expect(isWeekExpired(null)).toBe(true)
  })

  it('returns true for undefined', () => {
    expect(isWeekExpired(undefined)).toBe(true)
  })

  it('returns true for empty string', () => {
    expect(isWeekExpired('')).toBe(true)
  })

  it('returns true for an invalid date string', () => {
    expect(isWeekExpired('not-a-date')).toBe(true)
  })
})

describe('getLimit', () => {
  it('returns the correct free plan event limit', () => {
    expect(getLimit('free', 'events_per_month')).toBe(LIMITS.free.events_per_month)
  })

  it('returns the correct pro plan event limit', () => {
    expect(getLimit('pro', 'events_per_month')).toBe(LIMITS.pro.events_per_month)
  })

  it('pro limit is greater than free limit for events', () => {
    expect(getLimit('pro', 'events_per_month')).toBeGreaterThan(getLimit('free', 'events_per_month'))
  })

  it('returns correct retention days', () => {
    expect(getLimit('free', 'retention_days')).toBe(30)
    expect(getLimit('pro',  'retention_days')).toBe(90)
  })
})

describe('isPro', () => {
  it('returns true for pro plan', () => {
    expect(isPro('pro')).toBe(true)
  })

  it('returns false for free plan', () => {
    expect(isPro('free')).toBe(false)
  })
})

describe('LIMITS constants', () => {
  it('pro plan has higher limits than free across all dimensions', () => {
    expect(LIMITS.pro.events_per_month).toBeGreaterThan(LIMITS.free.events_per_month)
    expect(LIMITS.pro.ai_per_week).toBeGreaterThan(LIMITS.free.ai_per_week)
    expect(LIMITS.pro.retention_days).toBeGreaterThan(LIMITS.free.retention_days)
  })

  it('free plan project and collaborator limits are finite and positive', () => {
    expect(LIMITS.free.projects).toBeGreaterThan(0)
    expect(LIMITS.free.collaborators_per_project).toBeGreaterThan(0)
  })
})
