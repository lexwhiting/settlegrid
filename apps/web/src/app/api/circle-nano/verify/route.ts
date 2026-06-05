/**
 * Circle Nanopayments facilitator — verify route (P5 kernel-dispatch, Tier 1).
 *
 * Called by the SDK dispatch kernel's `handleFacilitatorProtocol` as
 *   POST ${apiUrl}/api/circle-nano/verify   { toolSlug, paymentContext, method }
 * and expects a RAW `{ valid: boolean, error?, code? }` body (see
 * packages/mcp/src/kernel.ts `facilitatorVerify`). This is a DIFFERENT
 * contract from the public x402 facilitator routes (`{ paymentPayload }`) —
 * here the caller is the kernel.
 *
 * The EIP-3009 authorization travels in `paymentContext.payment.proof` (the
 * circle-nano adapter's extractPaymentContext captures the x-circle-nano-auth
 * payload there). Verification is OFFLINE — recover the EIP-712 signer and
 * enforce payee == SETTLEGRID_USDC_RECIPIENT, the time window, and the
 * authorized amount >= the tool's REGISTERED price — so no Circle account,
 * API key, or chain RPC is required.
 *
 * Money-safety: the kernel demo never reaches this route — the demo's
 * sg.apiUrl points at /api/demo/sandbox, whose catch-all returns stubs for
 * /api/circle-nano/{verify,settle}. Only a self-hosted SDK kernel pointed at
 * the real app URL lands here, and only for a real, active tool.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { resolveOperationCost } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isCircleNanoKernelEnabled } from '@/lib/env'
import { validateCircleNanoCredentialString } from '@/lib/circle-nano-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// EIP-712 signature recovery uses viem (pure secp256k1/keccak, no chain RPC).
// Pin the Node runtime so a future edge-default flip can't silently break it.
export const runtime = 'nodejs'
export const maxDuration = 30
export { corsOptions as OPTIONS }

/**
 * Kernel facilitator verify envelope. `paymentContext` is the full normalized
 * PaymentContext; we only read `payment.proof` (the serialized EIP-3009
 * authorization), so the rest passes through unvalidated rather than
 * re-declaring the adapter's PaymentContext shape here.
 */
const verifySchema = z.object({
  toolSlug: z.string().min(1).max(200),
  method: z.string().min(1).max(200),
  paymentContext: z
    .object({
      payment: z.object({ proof: z.string().optional() }).passthrough(),
    })
    .passthrough(),
})

/**
 * Resolve the tool's registered cost for `method`. Defensive against an
 * unexpected jsonb shape — resolveOperationCost throws on a null/garbage
 * pricing config, so guard + fall back to 0. (Fail-open on cost is
 * acceptable: the signature / recipient / time checks remain the real gate,
 * and a 0 cost only means any non-negative authorized amount is "sufficient".)
 */
function resolveCostCents(pricingConfig: unknown, method: string): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 0
  try {
    const cost = resolveOperationCost(
      pricingConfig as Parameters<typeof resolveOperationCost>[0],
      method,
    )
    return Number.isFinite(cost) && cost >= 0 ? Math.floor(cost) : 0
  } catch {
    return 0
  }
}

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `circle-nano-verify:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, verifySchema)
    const { toolSlug, method, paymentContext } = body

    logger.info('circle_nano.verify_request', { toolSlug, method })

    // valid:false at HTTP 200 (not a non-2xx): the kernel reads `valid`; a
    // non-2xx body would be misread as a facilitator outage (503).
    if (!isCircleNanoKernelEnabled()) {
      return successResponse({
        valid: false,
        error: 'Circle Nanopayments are not configured on this SettleGrid instance.',
        code: 'CIRCLE_NANO_NOT_CONFIGURED',
      })
    }

    // Server-authoritative tool + cost lookup. The kernel sends `method` but
    // NOT a price; the EIP-3009 authorized amount is checked against the
    // tool's REGISTERED cost resolved here, never a client-supplied value.
    const [toolRow] = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        status: tools.status,
        pricingConfig: tools.pricingConfig,
      })
      .from(tools)
      .where(eq(tools.slug, toolSlug))
      .limit(1)

    if (!toolRow || toolRow.status !== 'active') {
      return successResponse({
        valid: false,
        error: 'Tool not found or not active.',
        code: 'CIRCLE_NANO_API_ERROR',
      })
    }

    const costCents = resolveCostCents(toolRow.pricingConfig, method)
    const proof =
      typeof paymentContext.payment.proof === 'string'
        ? paymentContext.payment.proof
        : null

    const result = await validateCircleNanoCredentialString(proof, {
      slug: toolRow.slug,
      costCents,
      displayName: toolRow.name,
    })

    if (!result.valid) {
      logger.info('circle_nano.verify_rejected', {
        toolSlug,
        method,
        code: result.error?.code,
      })
      return successResponse({
        valid: false,
        error: result.error?.message ?? 'Circle Nanopayment verification failed.',
        code: result.error?.code ?? 'CIRCLE_NANO_AUTH_INVALID',
      })
    }

    return successResponse({ valid: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
