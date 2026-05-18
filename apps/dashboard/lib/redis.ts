import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 100 requests per 60 seconds per api_key — SDK ingest endpoint
export const ingestRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
  prefix: 'ultron:ingest',
})

// 10 requests per 60 seconds per user — Stripe checkout / portal (expensive external calls)
export const billingRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'ultron:billing',
})

// 20 requests per 60 seconds per user — AI fix suggestions (OpenAI calls)
export const fixRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '60 s'),
  analytics: true,
  prefix: 'ultron:fix',
})

// 30 requests per 60 seconds per user — general mutating API routes
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
  prefix: 'ultron:api',
})
