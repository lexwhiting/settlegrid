/**
 * P4.K1 — public kernel demo proxy.
 *
 * The browser POSTs a request spec (target URL, headers, body) to
 * this route. The route reconstructs a `Request` object and runs it
 * through the SAME `@settlegrid/mcp` kernel build the production tool
 * SDK ships, configured with sandbox URLs (`/api/demo/sandbox/...`)
 * so no real money is touched.
 *
 * Hostile-review checklist:
 *   (a) NO REAL MONEY: kernel network calls all hit the sandbox
 *       catch-all, which is itself stub-only (asserted in
 *       `demo-kernel.test.ts`).
 *   (b) SERVER-SIDE CREDENTIALS: the toolSecret is added on the
 *       server, after stripping any inbound `Authorization` header
 *       the visitor may have set. Visitor-provided headers are still
 *       forwarded for OTHER detection signals (e.g. x-api-key, x-
 *       payment-required), but any value the kernel uses to call the
 *       sandbox is set here.
 *   (c) SAME KERNEL BUILD: imports `createDispatchKernel` directly
 *       from `@settlegrid/mcp`. No fork.
 *
 * Rate limit: 30 requests / hour / IP (see `demo-rate-limit.ts`).
 * Hard-cap on body size: 16 KiB (anti-DoS; payment headers + small
 * JSON bodies are well within this).
 */

import { NextResponse } from 'next/server'
import {
  buildDemoKernel,
  demoHandler,
  inspectRouting,
  type RoutingDecision,
} from '@/lib/demo-kernel-config'
import { checkDemoRateLimit } from '@/lib/demo-rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/** Hard cap on visitor-supplied request body length, in bytes. */
const MAX_BODY_BYTES = 16 * 1024

/** Hard cap on number of headers a visitor can attach. */
const MAX_HEADERS = 32

/** Hard cap on header value length, in chars. */
const MAX_HEADER_VALUE_LEN = 4096

/**
 * Headers the visitor cannot set on the reconstructed Request. These
 * are server-side concerns (auth to the sandbox) or
 * connection-machinery the kernel doesn't read anyway. Stripping
 * them prevents a visitor from forging a kernel→sandbox auth header.
 */
const VISITOR_HEADER_DENYLIST = new Set([
  'authorization',
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'cookie',
])

interface KernelInvokeRequest {
  /** Target URL the kernel sees (illustrative — not actually fetched). */
  url?: string
  /** HTTP method the kernel sees. Defaults to POST. */
  method?: string
  /** Header pairs the visitor attaches. Filtered through the denylist. */
  headers?: Record<string, string>
  /** JSON-serializable request body. Stringified before reconstruction. */
  body?: unknown
}

interface KernelInvokeResponse {
  routingDecision: RoutingDecision
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: unknown
    bodyText: string
  }
  rateLimit: {
    limit: number
    remaining: number
    reset: number
  }
}

export async function POST(req: Request): Promise<Response> {
  // 1. Rate limit (fail-open on Upstash failure).
  const rate = await checkDemoRateLimit(req.headers)
  const rateLimitHeaders: Record<string, string> = {
    'x-ratelimit-limit': String(rate.limit),
    'x-ratelimit-remaining': String(rate.remaining),
    'x-ratelimit-reset': String(rate.reset),
  }
  if (!rate.success) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `Demo limit is ${rate.limit} requests/hour/IP. Try again at ${new Date(
          rate.reset,
        ).toISOString()}.`,
      },
      { status: 429, headers: rateLimitHeaders },
    )
  }

  // 2. Parse + validate the request spec.
  let spec: KernelInvokeRequest
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'request_too_large', maxBytes: MAX_BODY_BYTES },
        { status: 413, headers: rateLimitHeaders },
      )
    }
    spec = text.length > 0 ? (JSON.parse(text) as KernelInvokeRequest) : {}
  } catch {
    return NextResponse.json(
      {
        error: 'malformed_json',
        message: 'Request body must be JSON of shape { url, method, headers, body }.',
      },
      { status: 400, headers: rateLimitHeaders },
    )
  }

  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return NextResponse.json(
      { error: 'malformed_spec', message: 'Body must be a JSON object.' },
      { status: 400, headers: rateLimitHeaders },
    )
  }

  // 3. Reconstruct the Request the kernel will see.
  let kernelRequest: Request
  try {
    kernelRequest = reconstructKernelRequest(spec)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid_spec',
        message: err instanceof Error ? err.message : 'Could not reconstruct request.',
      },
      { status: 400, headers: rateLimitHeaders },
    )
  }

  // 4. Pre-call routing inspection. We clone the request so the
  //    kernel's later `extractPaymentContext` sees an unconsumed body.
  const inspectionRequest = kernelRequest.clone()
  const routingDecision = inspectRouting(inspectionRequest)

  // 5. Dispatch through the unmodified kernel. The kernel's
  //    contract guarantees handle() does not throw — but we wrap
  //    for defense-in-depth so a kernel bug surfaces as 500 here
  //    instead of crashing the route.
  let kernelResponse: Response
  try {
    const kernel = buildDemoKernel()
    kernelResponse = await kernel.handle(kernelRequest, demoHandler)
  } catch (err) {
    logger.error(
      'demo.kernel.handle_threw',
      { identifier: rate.identifier },
      err,
    )
    return NextResponse.json(
      {
        error: 'kernel_unhandled_exception',
        message:
          'The kernel threw outside its documented contract. This is a bug — please report it.',
      },
      { status: 500, headers: rateLimitHeaders },
    )
  }

  // 6. Decode the kernel response into a UI-friendly shape.
  const decoded = await decodeKernelResponse(kernelResponse)

  const result: KernelInvokeResponse = {
    routingDecision,
    response: decoded,
    rateLimit: {
      limit: rate.limit,
      remaining: rate.remaining,
      reset: rate.reset,
    },
  }

  return NextResponse.json(result, {
    status: 200,
    headers: rateLimitHeaders,
  })
}

/**
 * Reconstruct a `Request` from the visitor-supplied spec. Throws on
 * spec violations (denied headers, oversized values, invalid URL).
 */
function reconstructKernelRequest(spec: KernelInvokeRequest): Request {
  const url =
    typeof spec.url === 'string' && spec.url.length > 0
      ? spec.url
      : 'https://demo.settlegrid.ai/api/demo-tool/invoke'

  // Validate the URL is well-formed before passing to `new Request`,
  // which throws a less-helpful TypeError on bad inputs. The
  // constructed URL is intentionally discarded — we only want the
  // throw-on-invalid behavior.
  try {
    void new URL(url)
  } catch {
    throw new Error(`Invalid url: ${JSON.stringify(url)}`)
  }

  const method =
    typeof spec.method === 'string' && spec.method.length > 0
      ? spec.method.toUpperCase()
      : 'POST'

  const safeHeaders = sanitizeHeaders(spec.headers ?? {})

  // Body: only include for methods that allow it. GET/HEAD throw if
  // we attach a body. Everything else passes through as JSON if it
  // wasn't already a string.
  let body: BodyInit | undefined
  if (method !== 'GET' && method !== 'HEAD' && spec.body !== undefined) {
    if (typeof spec.body === 'string') {
      body = spec.body
    } else {
      body = JSON.stringify(spec.body)
      if (!safeHeaders.has('content-type')) {
        safeHeaders.set('content-type', 'application/json')
      }
    }
  }

  return new Request(url, {
    method,
    headers: safeHeaders,
    body,
  })
}

/**
 * Apply the header denylist + size caps to visitor-supplied headers.
 * Returns a `Headers` object ready for `new Request(...)`.
 */
function sanitizeHeaders(raw: Record<string, string>): Headers {
  const out = new Headers()
  let count = 0
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || typeof value !== 'string') continue
    const lower = key.toLowerCase()
    if (VISITOR_HEADER_DENYLIST.has(lower)) continue
    if (value.length > MAX_HEADER_VALUE_LEN) continue
    out.set(lower, value)
    count++
    if (count >= MAX_HEADERS) break
  }
  return out
}

/**
 * Decode the kernel's `Response` into the JSON shape the response
 * viewer renders. Reads the body as text first, then attempts JSON
 * parsing — falls back to the raw string for protocol-specific
 * binary or non-JSON responses (none ship today, but the shape
 * future-proofs).
 */
async function decodeKernelResponse(
  response: Response,
): Promise<KernelInvokeResponse['response']> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  const bodyText = await response.text()
  let body: unknown = bodyText
  if (bodyText.length > 0) {
    try {
      body = JSON.parse(bodyText) as unknown
    } catch {
      // Non-JSON body — `body` stays as the raw string.
    }
  }

  return {
    status: response.status,
    statusText: response.statusText || statusTextFor(response.status),
    headers,
    body,
    bodyText,
  }
}

/** Default status-text mapping for browsers that omit `statusText`. */
function statusTextFor(status: number): string {
  if (status === 200) return 'OK'
  if (status === 400) return 'Bad Request'
  if (status === 402) return 'Payment Required'
  if (status === 401) return 'Unauthorized'
  if (status === 429) return 'Too Many Requests'
  if (status === 500) return 'Internal Server Error'
  return ''
}
