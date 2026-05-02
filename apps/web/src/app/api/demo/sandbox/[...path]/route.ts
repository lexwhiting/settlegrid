/**
 * P4.K1 — sandbox facilitator/middleware endpoints for the kernel demo.
 *
 * The kernel composes outbound URLs as
 *   - `${apiUrl}/api/${protocol}/${action}` for facilitator protocols
 *     (x402, mpp): `verify` and `settle`
 *   - `${apiUrl}/api/sdk/${path}` for sg-balance protocol middleware:
 *     `validate-key` and `meter`
 *
 * Pointing the demo's `sg.apiUrl` at this route's prefix
 * (`/api/demo/sandbox`) means every kernel-issued network call
 * lands here as a path under `[...path]`. We dispatch by exact path
 * and return deterministic JSON stubs with no side effects.
 *
 * Hostile-review invariant: NOTHING in this file may call into
 * production payment code. The file imports nothing from `@/lib/db`,
 * `@/lib/stripe`, `@/lib/settlement`, or any payment library. A
 * vitest suite asserts this on the source as a regression guard.
 */

import { NextResponse } from 'next/server'
import {
  DEMO_TOOL_SECRET,
  DEMO_TOOL_SLUG,
} from '@/lib/demo-kernel-config'
import { checkDemoRateLimit } from '@/lib/demo-rate-limit'

// Force this route to run on the Node.js runtime so a future edge
// migration of the surrounding routes can't accidentally regress the
// sandbox into edge-mode (which would expose a different mock surface).
export const runtime = 'nodejs'

/**
 * Hard cap on the kernel-supplied request body, in bytes. The kernel
 * sends small JSON payloads (validate-key with one apiKey field,
 * meter with five fields, verify/settle with the payment context
 * envelope). A ~16 KiB cap is comfortably above the largest expected
 * shape and well below anything that would consume meaningful memory
 * if a direct-curl client tries to flood the route.
 */
const MAX_SANDBOX_BODY_BYTES = 16 * 1024

interface SandboxContext {
  params: Promise<{ path: string[] }>
}

/**
 * Confirm the inbound request looks like it came from a kernel
 * configured with the demo's toolSecret. NOT a security boundary —
 * the toolSecret is a public constant in this codebase. The check
 * exists to make accidental misuse loud: if a developer builds a
 * different kernel and mistakenly points its apiUrl at this prefix,
 * they'll see a clear 401 instead of a confusingly successful
 * response.
 */
function authHeaderMatchesDemoSecret(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (typeof auth !== 'string') return false
  return auth === `Bearer ${DEMO_TOOL_SECRET}`
}

export async function POST(
  req: Request,
  context: SandboxContext,
): Promise<Response> {
  // Apply the demo rate limit BEFORE body read so a flood of direct-
  // curl traffic against this catch-all (bypassing /api/demo/kernel)
  // can't drown the route. Same 30/hr/IP bucket as the kernel
  // proxy — one demo session shares the limit across both.
  const rate = await checkDemoRateLimit(req.headers)
  if (!rate.success) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `Demo limit is ${rate.limit} requests/hour/IP. Try again at ${new Date(
          rate.reset,
        ).toISOString()}.`,
      },
      {
        status: 429,
        headers: {
          'x-ratelimit-limit': String(rate.limit),
          'x-ratelimit-remaining': String(rate.remaining),
          'x-ratelimit-reset': String(rate.reset),
        },
      },
    )
  }

  const { path } = await context.params
  const route = '/' + path.join('/')

  // Best-effort body read — used to echo specific fields back into
  // the stubbed response so the response viewer shows a coherent
  // story (e.g. operationId derived from method). Capped at
  // MAX_SANDBOX_BODY_BYTES so a direct-curl client can't drown us
  // with a multi-megabyte body before the unknown-path 404 fires.
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.length > MAX_SANDBOX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'request_too_large', maxBytes: MAX_SANDBOX_BODY_BYTES },
        { status: 413 },
      )
    }
    if (text.length > 0) {
      const parsed = JSON.parse(text) as unknown
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>
      }
    }
  } catch {
    // Malformed body — fall through with `body = {}`. Most stubs
    // tolerate missing fields; the kernel's contract is only that
    // the response shape is correct.
  }

  switch (route) {
    case '/api/sdk/validate-key':
      return validateKeyStub(body)

    case '/api/sdk/meter':
      return meterStub(body)

    case '/api/x402/verify':
    case '/api/mpp/verify':
      // The kernel reads the toolSecret on the verify path; mirror
      // the auth check here to catch misconfiguration loudly.
      if (!authHeaderMatchesDemoSecret(req)) {
        return NextResponse.json(
          {
            valid: false,
            error: 'sandbox-auth-mismatch',
            code: 'SANDBOX_AUTH',
          },
          { status: 401 },
        )
      }
      return verifyStub()

    case '/api/x402/settle':
    case '/api/mpp/settle':
      if (!authHeaderMatchesDemoSecret(req)) {
        return NextResponse.json(
          { error: 'sandbox-auth-mismatch', code: 'SANDBOX_AUTH' },
          { status: 401 },
        )
      }
      return settleStub(route, body)

    default:
      return NextResponse.json(
        {
          error: 'unknown-sandbox-path',
          received: route,
          knownRoutes: [
            '/api/sdk/validate-key',
            '/api/sdk/meter',
            '/api/x402/verify',
            '/api/x402/settle',
            '/api/mpp/verify',
            '/api/mpp/settle',
          ],
        },
        { status: 404 },
      )
  }
}

/**
 * Stub for `middleware.validateKey`. Real implementation looks up the
 * key in `consumerApiKeys`, returns `{ valid, consumerId, toolId,
 * keyId, balanceCents }`. Demo returns deterministic values keyed off
 * the tool slug — no DB read, no consumer lookup.
 */
function validateKeyStub(body: Record<string, unknown>): Response {
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
  // Always-valid stub, BUT only for keys with the demo prefix or any
  // non-empty string. Empty key is treated as invalid so the kernel's
  // InvalidKeyError path can be exercised by visitors who send a
  // request with no `x-api-key` header but try to invoke MCP.
  const valid = apiKey.length > 0
  return NextResponse.json({
    valid,
    consumerId: valid ? 'demo-consumer-id' : '',
    toolId: valid ? 'demo-tool-id' : '',
    keyId: valid ? 'demo-key-id' : '',
    balanceCents: valid ? 100_000 : 0,
  })
}

/**
 * Stub for `middleware.meter`. Real implementation deducts credits +
 * writes a usage row + returns `{ success, invocationId, costCents,
 * remainingBalanceCents }`. Demo computes a fake invocationId and
 * leaves the balance as a fixed value minus a fixed cost.
 */
function meterStub(body: Record<string, unknown>): Response {
  const method = typeof body.method === 'string' ? body.method : 'unknown'
  return NextResponse.json({
    success: true,
    invocationId: `demo-inv-${cryptoRandomId()}`,
    costCents: 5,
    remainingBalanceCents: 99_995,
    method,
  })
}

function verifyStub(): Response {
  return NextResponse.json({ valid: true })
}

/**
 * Stub for facilitator settle (`/api/x402/settle`,
 * `/api/mpp/settle`). The kernel's `validateSettlementResult` requires
 * a SettlementResult-shaped body with status, operationId, costCents,
 * and metadata. Returning a malformed shape would surface as a
 * `SettleGridUnavailableError` from the kernel — which is testable
 * but not what the happy-path demo wants to show.
 */
function settleStub(route: string, body: Record<string, unknown>): Response {
  const protocol: 'x402' | 'mpp' = route.startsWith('/api/x402')
    ? 'x402'
    : 'mpp'
  const method =
    typeof body.method === 'string' ? body.method : 'demo.invocation'
  return NextResponse.json({
    status: 'settled',
    operationId: `demo-op-${cryptoRandomId()}`,
    costCents: 5,
    remainingBalanceCents: 99_995,
    metadata: {
      protocol,
      latencyMs: 42,
      settlementType: 'real-time',
      method,
      toolSlug: DEMO_TOOL_SLUG,
    },
  })
}

/**
 * Lightweight ID generator — node:crypto.randomUUID is overkill for
 * a demo invocation marker. Eight hex chars from Math.random is fine
 * for human-readable distinctness within a session.
 */
function cryptoRandomId(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0')
}
