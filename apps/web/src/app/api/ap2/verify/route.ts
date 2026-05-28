/**
 * AP2 facilitator — verify route (P5 kernel-dispatch, Tier 1).
 *
 * Called by the SDK dispatch kernel's `handleFacilitatorProtocol` as
 * `POST ${apiUrl}/api/ap2/verify` with the body
 *   { toolSlug, paymentContext, method }
 * and expects a RAW `{ valid: boolean, error?, code? }` body (see
 * packages/mcp/src/kernel.ts `facilitatorVerify`). This is a DIFFERENT
 * contract from the public x402 facilitator routes (`{ paymentPayload }`),
 * which serve direct x402 clients — here the caller is the kernel.
 *
 * The VDC JWT travels in `paymentContext.payment.proof` (the AP2 adapter's
 * extractPaymentContext captures it there). Validation — HMAC signature,
 * issuer, expiry, and authorized-amount >= the tool's REGISTERED price — is
 * server-side because the signing secret (AP2_SIGNING_SECRET) never leaves
 * this server.
 *
 * Money-safety: the kernel demo never reaches this route — the demo's
 * sg.apiUrl points at /api/demo/sandbox, whose catch-all returns stubs for
 * /api/ap2/{verify,settle}. Only a self-hosted SDK kernel pointed at the
 * real app URL lands here, and only for a real, active tool.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { resolveOperationCost } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isAp2Enabled } from '@/lib/env'
import { validateAp2CredentialString } from '@/lib/ap2-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// VDC validation uses node:crypto (HMAC / timingSafeEqual). Pin the Node
// runtime so a future edge-default flip can't silently break it.
export const runtime = 'nodejs'
export const maxDuration = 30
export { corsOptions as OPTIONS }

/**
 * Kernel facilitator verify envelope. `paymentContext` is the full
 * normalized PaymentContext; we only read `payment.proof` (the VDC JWT),
 * so the rest passes through unvalidated rather than re-declaring the
 * adapter's PaymentContext shape here.
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
 * acceptable: the signature / issuer / expiry checks remain the real gate,
 * and a 0 cost only means any positive VDC amount is "sufficient".)
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
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `ap2-verify:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, verifySchema)
    const { toolSlug, method, paymentContext } = body

    logger.info('ap2.verify_request', { toolSlug, method })

    // valid:false at HTTP 200 (not a non-2xx): the kernel reads `valid`; a
    // non-2xx body would be misread as a facilitator outage (503).
    if (!isAp2Enabled()) {
      return successResponse({
        valid: false,
        error: 'AP2 payments are not configured on this SettleGrid instance.',
        code: 'AP2_NOT_CONFIGURED',
      })
    }

    // Server-authoritative tool + cost lookup. The kernel sends `method`
    // but NOT a price; the VDC's authorized amount is checked against the
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
        code: 'AP2_PROVIDER_ERROR',
      })
    }

    const costCents = resolveCostCents(toolRow.pricingConfig, method)
    const credential =
      typeof paymentContext.payment.proof === 'string'
        ? paymentContext.payment.proof
        : null

    const result = await validateAp2CredentialString(credential, {
      slug: toolRow.slug,
      costCents,
      displayName: toolRow.name,
      merchantId: 'settlegrid_platform',
    })

    if (!result.valid) {
      logger.info('ap2.verify_rejected', {
        toolSlug,
        method,
        code: result.error?.code,
      })
      return successResponse({
        valid: false,
        error: result.error?.message ?? 'AP2 verification failed.',
        code: result.error?.code ?? 'AP2_PAYMENT_FAILED',
      })
    }

    return successResponse({ valid: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
