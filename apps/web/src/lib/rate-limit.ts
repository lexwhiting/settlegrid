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
