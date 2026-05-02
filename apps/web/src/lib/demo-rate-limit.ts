/**
 * P4.K1 — IP-keyed rate limiter for the public kernel demo.
 *
 * 30 requests per hour per IP. Tuned to the spec's anti-abuse target;
 * not a security boundary, so it fails OPEN when the underlying
 * Upstash limiter is unreachable: a public demo that 500s because
 * Redis blipped is worse than a brief unbounded window.
 *
 * Identifier resolution prefers `x-forwarded-for` (Vercel's proxy
 * sets this), falls back to `x-real-ip`, and finally to a sentinel
 * 'unknown-ip'. The sentinel means burst-from-anonymous-proxy is
 * pooled into a single bucket, which is the desired conservative
 * behavior for an unauthenticated public endpoint.
 */

import type { Ratelimit } from '@upstash/ratelimit'
import { createRateLimiter, type RateLimitResult } from './rate-limit'
import { logger } from './logger'

/** Hard cap from the P4.K1 spec — 30 requests per IP per hour. */
export const DEMO_RATE_LIMIT_REQUESTS = 30 as const

/** 1-hour sliding window. Matches the spec wording ("per IP per hour"). */
export const DEMO_RATE_LIMIT_WINDOW = '1 h' as const

/**
 * Lazily-instantiated demo limiter. Module load is cheap (no Redis
 * connection), but we still defer creation so unit tests that mock
 * `getRedis` see the mock when the limiter is first used, not at
 * import time.
 */
let cachedLimiter: Ratelimit | null = null
function getLimiter(): Ratelimit {
  if (!cachedLimiter) {
    cachedLimiter = createRateLimiter(
      DEMO_RATE_LIMIT_REQUESTS,
      DEMO_RATE_LIMIT_WINDOW,
    )
  }
  return cachedLimiter
}

/**
 * Test-only reset so a vitest mock of getRedis() takes effect on the
 * next call. Production callers never need this.
 */
export function __resetDemoRateLimiterForTests(): void {
  cachedLimiter = null
}

/**
 * Best-effort IP extraction from a Next.js request's headers.
 *
 * Trust model: this function ASSUMES the runtime is fronted by a
 * trusted proxy (Vercel, Cloudflare, AWS ALB) that authoritatively
 * sets `x-forwarded-for` to the real client IP at index 0, with any
 * inbound visitor-supplied entries appended to the right. On
 * Vercel — the deploy target this repo is calibrated for — this
 * holds: Vercel rewrites `x-forwarded-for` before user code runs,
 * placing the actual edge-observed IP at the head of the list.
 *
 * If you redeploy this code somewhere without that property
 * (Render, Fly.io with default config, raw Node behind a basic
 * reverse proxy), a malicious visitor can spoof the rate-limit
 * bucket key by setting their own `x-forwarded-for: trusted-ip`.
 * That degrades the demo's rate limit from "30/hr/IP" to "30/hr
 * per spoofed-IP" — still anti-abuse, just bypassable per actor.
 *
 * We take only the LEFT-most entry: with the proxy-trust model,
 * that entry is the trusted one; in the no-trust model, every
 * entry is equally untrusted, so `[0]` is no worse than `[N-1]`.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first && first.length > 0) return first
  }
  const real = headers.get('x-real-ip')
  if (real && real.length > 0) return real.trim()
  return 'unknown-ip'
}

/**
 * Apply the demo rate limit for an inbound request. Returns the
 * {@link RateLimitResult} on success/limit-exceeded; on transport
 * failure (Upstash down), returns a fail-open synthetic result with
 * `success: true` so the demo continues to function.
 *
 * Callers should:
 *   - Forward `result.limit` / `result.remaining` / `result.reset`
 *     into response headers (`x-ratelimit-*`) regardless of success.
 *   - Return HTTP 429 only when `result.success === false`.
 */
export async function checkDemoRateLimit(
  headers: Headers,
): Promise<RateLimitResult & { identifier: string }> {
  const identifier = extractClientIp(headers)
  try {
    const limiter = getLimiter()
    const result = await limiter.limit(`demo-kernel:${identifier}`)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      identifier,
    }
  } catch (err) {
    // Fail open: log + allow. The demo is anti-abuse, not auth.
    logger.warn('demo.rate_limit.fail_open', {
      identifier,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: true,
      limit: DEMO_RATE_LIMIT_REQUESTS,
      remaining: DEMO_RATE_LIMIT_REQUESTS,
      reset: Date.now() + 60 * 60 * 1000,
      identifier,
    }
  }
}
