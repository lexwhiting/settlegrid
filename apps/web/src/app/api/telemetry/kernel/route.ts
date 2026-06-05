/**
 * P5.K1 — Kernel telemetry sink (sibling to /api/telemetry/capture).
 *
 * POST endpoint the SDK kernel's emitter targets. Validates +
 * persists to `kernel_telemetry` AND forwards to PostHog
 * server-side. The forward prefers `POSTHOG_API_KEY` and falls back
 * to `NEXT_PUBLIC_POSTHOG_KEY` so the same env config that the
 * client-side analytics already use will work for the kernel sink
 * without a separate variable. Either way the key is read from the
 * server's process env — neither is bundled into the SDK tarball
 * the kernel ships in. (PostHog's `/i/v0/e/` event-capture endpoint
 * is keyed on the project key, which is correctly public; the
 * fallback does not weaken the secrecy posture.)
 *
 * # Auth
 *
 * Bearer token in `Authorization: Bearer <KERNEL_TELEMETRY_AUTH_TOKEN>`.
 * Pre-launch the env var is unset; the route returns
 * `{ ok: true, forwarded: false, reason: 'sink_disabled' }` on a
 * configuration miss so SDK callers can stop trying without retry-
 * looping. No auth header → 401 (caller-side bug, not configuration).
 *
 * # Hostile invariants
 *
 * - Allow-list event names against `KERNEL_EVENT_NAMES` (event-name
 *   spoofing collapses to 400).
 * - Cap properties payload size (≤ 4 KB serialized).
 * - Constant-time comparison for the auth token (no timing-oracle
 *   on the token).
 * - Rate-limit per first-hop IP — 600 req/min, generous because
 *   high-traffic tools may emit many events per second.
 * - No echo of the bearer token in any 4xx/5xx body (no info leak).
 */
import { NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { kernelTelemetry } from '@/lib/db/schema'
import { errorResponse, successResponse, internalErrorResponse } from '@/lib/api'
import { createRateLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { DEFAULT_POSTHOG_HOST } from '@/lib/posthog'

export const maxDuration = 10

const KERNEL_EVENT_NAMES = [
  'kernel.request_received',
  'kernel.routing_decision',
  'kernel.adapter_latency_ms',
  'kernel.adapter_error',
  'kernel.invocation_settled',
] as const

const MAX_BODY_BYTES = 4 * 1024 // 4 KB

/**
 * Numeric properties the SQL aggregates cast to `int` / `bigint`.
 * Validated as JS-safe non-negative integers up front so a buggy
 * authenticated caller (or a future SDK regression that bypasses the
 * sanitizer) cannot park a `1.5` or `9e30` in jsonb that breaks every
 * subsequent dashboard query with `invalid input syntax for integer`.
 *
 * Floats / negatives / non-finite values fail the schema → 400; the
 * row is never inserted and the dashboard stays queryable.
 */
const SafeIntProp = z
  .number()
  .finite()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .int()

const KernelTelemetryBodySchema = z.object({
  name: z.enum(KERNEL_EVENT_NAMES),
  props: z
    .record(z.unknown())
    .refine(
      (p) => {
        for (const key of [
          'amount_cents',
          'take_cents',
          'latency_ms',
          'fee_bps',
        ] as const) {
          if (key in p && p[key] !== undefined) {
            const r = SafeIntProp.safeParse(p[key])
            if (!r.success) return false
          }
        }
        return true
      },
      { message: 'numeric props must be safe non-negative integers' },
    ),
  ts: z.string().datetime().optional(),
})

/**
 * 600 / minute. Heavy-traffic tools can emit several events per
 * invocation; the per-IP limit is per first-hop, so a single dev's
 * fleet under one egress IP comfortably fits.
 */
const limiter = createRateLimiter(600, '1 m')

/**
 * Constant-time bearer-token compare. Hostile-review hardening:
 * collapsing both inputs to a fixed-size sha256 digest BEFORE the
 * timing-safe compare removes the length-disclosure side-channel of
 * the previous string-length pre-check (`if (a.length !== b.length)
 * return false`). The hash output is always 32 bytes regardless of
 * input length, so a flooder probing different token lengths sees
 * indistinguishable response timing for the auth path.
 *
 * sha256 is collision-resistant; matching digests with non-matching
 * inputs is computationally infeasible at the level of this
 * primitive, so the digest compare is a sound proxy for the original
 * string compare.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

export async function POST(request: NextRequest) {
  // Rate limit by first-hop IP.
  const ip = getClientIp(request.headers)
  const rate = await checkRateLimit(limiter, `kernel-telemetry:${ip}`)
  if (!rate.success) {
    return errorResponse('Too many telemetry events.', 429, 'RATE_LIMITED')
  }

  // Auth.
  const expectedToken = process.env.KERNEL_TELEMETRY_AUTH_TOKEN
  if (!expectedToken) {
    // Sink disabled — caller should stop retrying. 200 (not 4xx) so
    // the SDK doesn't retry-loop; matches the P4.1 telemetry/capture
    // disabled-state pattern.
    return successResponse({
      ok: true,
      forwarded: false,
      reason: 'sink_disabled',
    })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return errorResponse('Bearer token required.', 401, 'UNAUTHORIZED')
  }
  const token = authHeader.slice(7).trim()
  if (!constantTimeEquals(token, expectedToken)) {
    return errorResponse('Invalid token.', 401, 'UNAUTHORIZED')
  }

  // Body cap. Two-tier check: (1) declared Content-Length short-
  // circuits BEFORE buffering the body into memory — matches the P4.1
  // capture-proxy pattern. A flooder declaring 100 MB is rejected at
  // the header check rather than after Vercel finishes streaming the
  // body in. (2) post-buffer length check catches chunked / unset
  // Content-Length cases.
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    const n = Number.parseInt(declared, 10)
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return errorResponse('Body exceeds 4 KB.', 413, 'PAYLOAD_TOO_LARGE')
    }
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return errorResponse('Body exceeds 4 KB.', 413, 'PAYLOAD_TOO_LARGE')
  }

  let parsed: z.infer<typeof KernelTelemetryBodySchema>
  try {
    parsed = KernelTelemetryBodySchema.parse(JSON.parse(raw))
  } catch (err) {
    // Don't echo the body back — could include event content the
    // dev didn't expect to see in error responses.
    logger.warn('kernel_telemetry.parse_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return errorResponse('Malformed body.', 400, 'INVALID_BODY')
  }

  // Denormalize adapter, rail, devId from props for indexed query.
  const props = parsed.props as Record<string, unknown>
  const adapter = typeof props.adapter === 'string' ? props.adapter : ''
  if (!adapter) {
    return errorResponse('props.adapter required.', 400, 'INVALID_BODY')
  }
  // Sanitizer collapses bad rail input to `''` upstream. Normalize
  // empty-string rail to NULL at the DB layer so the rails dashboard's
  // `WHERE rail IS NOT NULL` filter excludes them — otherwise stray
  // empty-string rails would surface in the rails table as a noisy
  // blank row.
  const railRaw = typeof props.rail === 'string' ? props.rail : null
  const rail = railRaw && railRaw.length > 0 ? railRaw : null
  // Spec §P5.K1 — kernel events use snake_case property names
  // (`dev_id`, `amount_cents`, `latency_ms`, etc.). The DB column
  // `dev_id` is denormalized from `props.dev_id`. Normalize empty
  // string to null for the same reason.
  const devIdRaw = typeof props.dev_id === 'string' ? props.dev_id : null
  const devId = devIdRaw && devIdRaw.length > 0 ? devIdRaw : null

  try {
    await db.insert(kernelTelemetry).values({
      eventName: parsed.name,
      adapter,
      rail,
      devId,
      props,
    })
  } catch (err) {
    logger.error('kernel_telemetry.db_insert_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return internalErrorResponse(
      err instanceof Error ? err : new Error('Failed to record telemetry.'),
    )
  }

  // Forward to PostHog (server-side, parallel sink). Best-effort —
  // a PostHog outage shouldn't fail the DB write the dashboard
  // depends on. Inlined here (instead of using `forwardToPostHog`)
  // because that helper's `EventName` type only covers funnel events;
  // kernel events live in their own namespace.
  const phApiKey =
    process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  let forwarded = false
  if (phApiKey) {
    const phHost = (
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST
    ).replace(/\/$/, '')
    // Use the normalized devId (empty-string already collapsed to null)
    // so a stray `dev_id: ''` doesn't surface as an empty distinct_id
    // in PostHog, which would silently merge unrelated traffic into
    // one user.
    const distinctId = devId ?? 'anonymous-kernel'
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      try {
        const phRes = await fetch(`${phHost}/i/v0/e/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: phApiKey,
            event: parsed.name,
            distinct_id: distinctId,
            properties: props,
            timestamp: parsed.ts ?? new Date().toISOString(),
          }),
          redirect: 'error',
          signal: controller.signal,
        })
        forwarded = phRes.ok
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      logger.warn('kernel_telemetry.posthog_forward_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return successResponse({ ok: true, forwarded })
}
