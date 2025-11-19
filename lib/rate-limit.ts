import { RateLimitInfo } from './types'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): RateLimitInfo {
  const now = Date.now()
  const key = identifier

  // Clean up expired entries
  if (store[key] && store[key].resetTime < now) {
    delete store[key]
  }

  // Initialize or get current limit info
  if (!store[key]) {
    store[key] = {
      count: 0,
      resetTime: now + config.windowMs,
    }
  }

  const limitInfo = store[key]

  // Increment count
  limitInfo.count++

  const remaining = Math.max(0, config.maxRequests - limitInfo.count)

  return {
    limit: config.maxRequests,
    remaining,
    reset: limitInfo.resetTime,
  }
}

export function isRateLimited(info: RateLimitInfo): boolean {
  return info.remaining <= 0
}

export function getRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': new Date(info.reset).toISOString(),
  }
}
