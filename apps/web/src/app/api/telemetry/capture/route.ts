/**
 * P4.1 — Telemetry capture proxy.
 *
 * Receives `{ event, properties, distinct_id }` from the CLI, SDK,
 * or any browser surface that prefers server-side capture, validates
 * + enriches + rate-limits, and forwards to PostHog using the
 * server-side `POSTHOG_API_KEY` (with `NEXT_PUBLIC_POSTHOG_KEY` as
 * a development fallback so a single phc_* key works locally).
 *
 * The PostHog key NEVER ships in the CLI / SDK tarballs — that's
 * the load-bearing reason this proxy exists. See docs/telemetry/events.md.
 *
 * Hostile invariants applied at scaffold time:
 *  - Allow-list event names against the canonical EVENT_NAMES.
 *  - Cap properties payload size (≤ 4 KB serialized).
 *  - Cap distinct_id length (≤ 256 chars).
 *  - Stamp `ip_country` + `received_at` server-side, overwriting any
 *    client-supplied values (no spoofing).
 *  - Rate-limit 60 req/min per first-hop IP via Upstash sliding window.
 *  - Never echo `distinct_id` or PostHog response in 4xx/5xx (no
 *    info leak / oracle).
 *  - 200 + `{ ok: true, forwarded: false, reason: 'telemetry_disabled' }`
 *    when the server-side key is unset, so CLI/SDK don't retry-loop.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, internalErrorResponse } from '@/lib/api'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  EVENT_NAMES,
  type EventName,
  isCanonicalEventName,
  forwardToPostHog,
  DEFAULT_POSTHOG_HOST,
} from '@/lib/posthog'

export const maxDuration = 10

// ─── Validation ──────────────────────────────────────────────────────────────

/** Hard cap on the JSON-serialized properties payload. 4 KB is well */
/** beyond what any of the eight events need; abuse stops here.       */
const MAX_PROPERTIES_BYTES = 4 * 1024
const MAX_DISTINCT_ID_LEN = 256

/**
 * Hostile-review fix (H1): reject oversized bodies BEFORE parsing
 * so a flooder can't force the runtime to allocate megabytes of
 * memory before our properties-size check fires. 8 KB is comfortably
 * larger than the 4 KB properties cap plus the JSON envelope
 * (`event`, `distinct_id`, key names, quotes, structural chars).
 *
 * The check is best-effort — Content-Length can be omitted by
 * chunked-transfer clients, in which case we fall back to the
 * post-parse size cap. That's acceptable: chunked uploads to a
 * telemetry endpoint are rare in practice, and the post-parse
 * cap still catches the abuse.
 */
const MAX_BODY_BYTES = 8 * 1024

/**
 * Zod schema for the capture body. The event name is constrained to
 * the canonical allow-list — Zod's enum() needs a non-empty tuple,
 * so we cast EVENT_NAMES (which is `readonly EventName[]` due to
 * Object.freeze).
 */
const captureSchema = z.object({
  event: z.enum(
    EVENT_NAMES as unknown as readonly [EventName, ...EventName[]],
  ),
  properties: z.record(z.unknown()).default({}),
  distinct_id: z.string().min(1).max(MAX_DISTINCT_ID_LEN),
})

// ─── Rate limiter (lazy — Upstash client constructed on first hit) ──────────

/**
 * 60 req/min per first-hop IP. Reuses the same Upstash sliding-
 * window pattern as `/api/waitlist`. Module-level singleton wrapped
 * in a Proxy so unit tests that `vi.mock('@/lib/rate-limit')` can
 * intercept the real client without paying the env-var cost.
 */
let _telemetryLimiter: ReturnType<typeof createRateLimiter> | null = null
function telemetryLimiter() {
  if (_telemetryLimiter === null) {
    _telemetryLimiter = createRateLimiter(60, '1 m')
  }
  return _telemetryLimiter
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * First-hop IP for the rate-limit key. Mirrors the waitlist H1 fix:
 * `x-forwarded-for` is a comma-separated proxy chain; only [0] (the
 * trusted edge's view of the originating client) is meaningful.
 */
function firstHopIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

/**
 * Vercel injects `x-vercel-ip-country` on every request (ISO-3166
 * alpha-2). Falls back to `'XX'` (ISO 3166 user-assigned reserved)
 * outside Vercel so PostHog doesn't see `null` and so dashboards
 * have a clean bucket for "no geolocation."
 */
function ipCountry(request: NextRequest): string {
  const country = request.headers.get('x-vercel-ip-country')
  if (country && /^[A-Z]{2}$/.test(country.toUpperCase())) {
    return country.toUpperCase()
  }
  return 'XX'
}

/**
 * Resolve the PostHog API key the proxy should forward with.
 * Priority: server-only POSTHOG_API_KEY → NEXT_PUBLIC_POSTHOG_KEY
 * (dev-only fallback so a single phc_* key works locally).
 *
 * Both are intentionally unguarded — when neither is set we return
 * undefined and the proxy responds with a `telemetry_disabled`
 * 200 instead of trying to forward and failing.
 */
function resolvePostHogKey(): string | undefined {
  const server = process.env.POSTHOG_API_KEY
  if (server && server.trim()) return server.trim()
  const client = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (client && client.trim()) return client.trim()
  return undefined
}

function resolvePostHogHost(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (host && host.trim()) return host.trim()
  return DEFAULT_POSTHOG_HOST
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit first — Zod parsing on the body is cheaper than
    // an Upstash round-trip, but parsing first lets a flooder force
    // arbitrary CPU work on us before being blocked. Limit-first is
    // the cheaper-to-reject path.
    const ip = firstHopIp(request)
    const rate = await checkRateLimit(telemetryLimiter(), `telemetry:${ip}`)
    if (!rate.success) {
      // No `Retry-After` body — 429 is self-explanatory and we don't
      // want to echo distinct_id / event back to a flooder.
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    // 2. Reject oversized bodies BEFORE request.json() parses them
    // into memory (hostile-review H1). Content-Length is operator-
    // trustworthy at the Vercel edge — a malicious client cannot
    // claim 100 bytes and then send 100 MB; the platform clamps at
    // its own configured maximum. We just need to short-circuit the
    // happy-path memory allocation for declared-large bodies.
    const contentLength = request.headers.get('content-length')
    if (contentLength !== null) {
      const declared = Number.parseInt(contentLength, 10)
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return errorResponse(
          'Telemetry payload too large.',
          413,
          'PAYLOAD_TOO_LARGE',
        )
      }
    }

    // 3. Parse + validate the body. We do NOT use parseBody() here
    // because a malformed JSON body should produce 400 (not 422), and
    // parseBody() conflates those at the route boundary. Inline keeps
    // the status codes faithful to the wire-shape contract.
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return errorResponse(
        'Request body must be valid JSON.',
        400,
        'INVALID_BODY',
      )
    }
    const parsed = captureSchema.safeParse(raw)
    if (!parsed.success) {
      // Don't include the offending payload in the error — info-leak
      // hardening (we don't want a misbehaving client to see what we
      // parsed off its body, and we don't want to echo distinct_id).
      return errorResponse(
        'Invalid telemetry payload.',
        400,
        'INVALID_PAYLOAD',
      )
    }

    const { event, properties, distinct_id } = parsed.data

    // 4. Belt-and-suspenders: validate the event name a second time
    // against the canonical list. Zod's enum is sufficient at runtime
    // but a future refactor could widen the schema; this guard
    // anchors the allow-list invariant in route code, not just the
    // schema definition.
    if (!isCanonicalEventName(event)) {
      return errorResponse(
        'Invalid telemetry payload.',
        400,
        'INVALID_PAYLOAD',
      )
    }

    // 5. Enforce properties size cap. We re-serialize after parsing to
    // measure normalised JSON, not the raw body — a client that
    // submits 4 MB of whitespace shouldn't slip past this check.
    let propertiesBytes: number
    try {
      propertiesBytes = Buffer.byteLength(JSON.stringify(properties), 'utf8')
    } catch {
      // Circular references or BigInt would throw here; reject as
      // invalid rather than risk passing a non-serializable payload
      // to PostHog.
      return errorResponse(
        'Invalid telemetry payload.',
        400,
        'INVALID_PAYLOAD',
      )
    }
    if (propertiesBytes > MAX_PROPERTIES_BYTES) {
      return errorResponse(
        'Telemetry payload too large.',
        413,
        'PAYLOAD_TOO_LARGE',
      )
    }

    // 6. Server-side enrichment. These two keys ALWAYS overwrite any
    // client-supplied value of the same name — preventing trivial
    // spoofing of geo / received_at.
    const enrichedProperties: Record<string, unknown> = {
      ...properties,
      ip_country: ipCountry(request),
      received_at: new Date().toISOString(),
    }

    // 7. Forward to PostHog. When no key is configured, return 200
    // with `forwarded: false` so the CLI/SDK don't see a 5xx and
    // back off / retry-loop. The reason is exposed because it's an
    // operator-side state, not a client-supplied secret.
    const apiKey = resolvePostHogKey()
    if (!apiKey) {
      return successResponse({
        ok: true,
        forwarded: false,
        reason: 'telemetry_disabled',
      })
    }

    const result = await forwardToPostHog({
      event,
      properties: enrichedProperties,
      distinctId: distinct_id,
      apiKey,
      host: resolvePostHogHost(),
    })

    if (!result.ok) {
      // Telemetry is best-effort but the CLI/SDK should still see a
      // 5xx so they don't pretend to have succeeded. We log the
      // reason server-side; we do NOT echo PostHog's response body
      // (info leak / oracle hardening).
      logger.warn('telemetry.forward_failed', {
        event,
        status: result.status,
        reason: result.reason,
      })
      return errorResponse(
        'Telemetry forward failed.',
        502,
        'UPSTREAM_UNAVAILABLE',
      )
    }

    return successResponse({ ok: true, forwarded: true })
  } catch (err) {
    return internalErrorResponse(err)
  }
}
