import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './redis'
import { logger } from './logger'

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

/** Behavior when the rate-limit store itself fails (H1, 2026-06-05). */
export type RateLimitFailMode = 'open' | 'closed'

/**
 * Checks the rate limit for a given identifier.
 * Returns a normalized result object.
 *
 * Availability contract (H1, 2026-06-05): a rate-limit STORE failure must
 * not take the API down. The Upstash client already fails open on a
 * HANGING store (built-in 5s timeout race → success:true,
 * reason:'timeout'); this guard covers the REJECTION path (connection
 * refused / DNS / auth / 5xx / missing env via the lazy limiters).
 * Default failMode 'open' (founder decision 2026-06-04): log a structured
 * operator alert and allow the request — rate limiting here is anti-abuse,
 * not authentication (same trust stance as checkDemoRateLimit). Pass
 * { failMode: 'closed' } for a route class where blocking on store-failure
 * is preferable (none do today; hook only).
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
  options?: { failMode?: RateLimitFailMode }
): Promise<RateLimitResult> {
  const failMode = options?.failMode ?? 'open'
  try {
    const result = await limiter.limit(identifier)

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (err) {
    logger.error(
      failMode === 'open' ? 'rate_limit.fail_open' : 'rate_limit.fail_closed',
      {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      }
    )
    // Mirrors the Upstash client's own timeout-response convention
    // ({ limit: 0, remaining: 0, reset: 0 }) so header-forwarding callers
    // degrade identically to the library's built-in fail-open.
    return { success: failMode === 'open', limit: 0, remaining: 0, reset: 0 }
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

/**
 * 5000 requests per minute — for the multi-hop IN-SESSION operation routes
 * (session-hop / session-get / session-finalize / session-complete), keyed
 * `session-*:${ip}`. Deliberately higher than the shared sdkLimiter (1000/min;
 * F1, 2026-06-08): a single NAT/cloud egress fronting many legitimate agents was
 * collectively throttled at 1000/min, dominated by the high-frequency hop route.
 * These four routes are budget-capped, non-financial, and do NOT insert a
 * workflow_sessions row (recordHop appends JSONB + increments spentCents; get
 * reads; finalize/complete are state transitions), so a higher per-IP ceiling
 * raises only infra load. The ROW-INSERTING session routes (session-create /
 * session-delegate, both via createSession's insert) deliberately STAY on the
 * shared sdkLimiter (1000/min) — in line with the platform's existing
 * unauth-row-insert limit (outcomes-create) — so this change does NOT amplify
 * the unbounded workflow_sessions growth. Every money path
 * (proxy / sdk-meter / billing-webhook / mcp) also stays on sdkLimiter.
 * See docs/tech-debt/h-f1-trace-2026-06-08.md §2.
 */
export const sessionLimiter = lazyLimiter(5000, '1 m')

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
 * Founding Members get Scale-tier limits regardless of their tier field.
 * Falls back to 'free' tier if tier is unknown.
 */
export function getTierLimits(tier: string, isFoundingMember?: boolean): TierLimits {
  if (isFoundingMember) return TIER_LIMITS.scale
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
    // H1: createRateLimiter eagerly calls getRedis() (requireEnv-backed) —
    // a creation throw here sits OUTSIDE checkRateLimit's guard, so it
    // gets the same fail-open treatment. Nothing is cached on failure;
    // the next call retries creation.
    try {
      limiter = createRateLimiter(requestsPerMin, '1 m')
    } catch (err) {
      logger.error('rate_limit.fail_open', {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      })
      return { success: true, limit: 0, remaining: 0, reset: 0 }
    }
    tieredLimiterCache.set(cacheKey, limiter)
  }

  return checkRateLimit(limiter, identifier)
}

// ─── Client IP extraction ─────────────────────────────────────────────────────

/**
 * Best-effort client-IP extraction for rate-limit bucket keys.
 *
 * Trust model (verified against official Vercel docs, 2026-06-05 —
 * vercel.com/docs/headers/request-headers): Vercel OVERWRITES inbound
 * `x-forwarded-for` and "do[es] not forward external IPs … to prevent IP
 * spoofing", so on the deploy target the left-most entry IS the
 * edge-observed client IP and `x-real-ip` is documented identical. On a
 * non-Vercel host without that property a visitor could spoof the bucket
 * key — that degrades per-IP limiting to per-spoofed-IP limiting (still
 * anti-abuse); if this code ever moves off Vercel, revisit (see
 * docs/tech-debt/h1-rate-limit-availability-build-plan-2026-06-05.md).
 *
 * Returns 'unknown-ip' when neither header is usable — pooling anonymous
 * traffic into one conservative bucket.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first && first.length > 0) return first
  }
  const real = headers.get('x-real-ip')
  if (real && real.length > 0) return real.trim()
  return 'unknown-ip'
}
