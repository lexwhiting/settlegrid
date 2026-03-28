import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './redis'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Creates a sliding-window rate limiter with the given parameters.
 * @param requests - Maximum number of requests allowed in the window
 * @param window - Time window string (e.g. '1 m', '1 h', '10 s')
 * @returns A rate limiter instance
 */
export function createRateLimiter(
  requests: number,
  window: `${number} ${'s' | 'ms' | 'm' | 'h' | 'd'}`
): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: 'settlegrid:ratelimit',
  })
}

/**
 * Checks the rate limit for a given identifier.
 * Returns a normalized result object.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

// ─── Pre-configured rate limiters (lazy — only instantiate on first use) ──────

function lazyLimiter(
  requests: number,
  window: `${number} ${'s' | 'ms' | 'm' | 'h' | 'd'}`
): Ratelimit {
  let instance: Ratelimit | null = null
  return new Proxy({} as Ratelimit, {
    get(_target, prop) {
      if (!instance) instance = createRateLimiter(requests, window)
      return (instance as unknown as Record<string | symbol, unknown>)[prop]
    },
  })
}

/** 5 requests per minute — for auth endpoints (login, register, password reset) */
export const authLimiter = lazyLimiter(5, '1 m')

/** 100 requests per minute — for standard API endpoints */
export const apiLimiter = lazyLimiter(100, '1 m')

/** 1000 requests per minute — for SDK/tool invocation endpoints */
export const sdkLimiter = lazyLimiter(1000, '1 m')

// ─── Tiered Rate Limiting ────────────────────────────────────────────────────

export type PlanTier = 'free' | 'builder' | 'scale' | 'enterprise'

export interface TierLimits {
  api: number // requests per minute
  sdk: number // requests per minute
}

const TIER_LIMITS: Record<PlanTier, TierLimits> = {
  free: { api: 30, sdk: 200 },
  builder: { api: 200, sdk: 4000 },
  scale: { api: 500, sdk: 16000 },
  enterprise: { api: 1000, sdk: 50000 },
}

/** Map legacy tier names to current tiers for rate limiting */
const TIER_ALIASES: Record<string, PlanTier> = {
  starter: 'builder',
  growth: 'builder',
}

/**
 * Returns the rate limits for a given plan tier.
 * Falls back to 'free' tier if tier is unknown.
 */
export function getTierLimits(tier: string): TierLimits {
  const lower = tier.toLowerCase()
  const resolved = TIER_ALIASES[lower] ?? lower
  return TIER_LIMITS[resolved as PlanTier] ?? TIER_LIMITS.free
}

// Cache of tiered rate limiters keyed by "tier:type"
const tieredLimiterCache = new Map<string, Ratelimit>()

/**
 * Checks rate limit using tier-specific limits.
 * @param identifier - Unique identifier (e.g. IP, API key, consumer ID)
 * @param tier - The plan tier of the user
 * @param type - 'api' or 'sdk'
 * @returns Rate limit result
 */
export async function checkTieredRateLimit(
  identifier: string,
  tier: string,
  type: 'api' | 'sdk'
): Promise<RateLimitResult> {
  const limits = getTierLimits(tier)
  const requestsPerMin = type === 'sdk' ? limits.sdk : limits.api
  const cacheKey = `${tier}:${type}`

  let limiter = tieredLimiterCache.get(cacheKey)
  if (!limiter) {
    limiter = createRateLimiter(requestsPerMin, '1 m')
    tieredLimiterCache.set(cacheKey, limiter)
  }

  return checkRateLimit(limiter, identifier)
}
