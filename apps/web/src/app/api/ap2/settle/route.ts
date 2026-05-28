/**
 * AP2 facilitator — settle route (P5 kernel-dispatch, Tier 1).
 *
 * Called by the SDK dispatch kernel's `handleFacilitatorProtocol` as
 * `POST ${apiUrl}/api/ap2/settle` with
 *   { toolSlug, paymentContext, handlerResult, latencyMs, method }
 * and expects a RAW SettlementResult body (status / operationId / costCents
 * / metadata) — see packages/mcp/src/kernel.ts `validateSettlementResult`.
 *
 * AP2 has no external settlement-rail call: the VDC IS the payment
 * authorization. "Settle" here re-validates the credential (verify-first,
 * mirroring /api/x402/settle) and returns the canonical SettlementResult
 * the adapter formats for the consumer. Writing the unified ledger is
 * deferred to P3.K4 router-wiring — the SAME gap x402/mpp settlement
 * already has through the kernel; AP2 ships at parity, not deeper. (Tracked
 * as DEBT in the audit chain.)
 *
 * Money-safety: identical to the verify route — the demo reaches the
 * /api/demo/sandbox stub, never this route.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { resolveOperationCost } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isAp2Enabled } from '@/lib/env'
import { validateAp2CredentialString } from '@/lib/ap2-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 60
export { corsOptions as OPTIONS }

const settleSchema = z.object({
  toolSlug: z.string().min(1).max(200),
  method: z.string().min(1).max(200),
  latencyMs: z.number().nonnegative().optional(),
  paymentContext: z
    .object({
      payment: z.object({ proof: z.string().optional() }).passthrough(),
    })
    .passthrough(),
  // Accepted for contract-completeness; AP2 cost is the tool's registered
  // per-invocation price, not handler-derived, so this is not read.
  handlerResult: z.unknown().optional(),
})

/**
 * See the identical helper in ../verify/route.ts. Inlined (not shared via a
 * lib) to match the repo's existing per-route cost-resolution pattern
 * (`getCostCents` is route-local in the proxy handler too).
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
    const rateLimit = await checkRateLimit(apiLimiter, `ap2-settle:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { toolSlug, method, paymentContext } = body
    const latencyMs = typeof body.latencyMs === 'number' ? body.latencyMs : 0

    logger.info('ap2.settle_request', { toolSlug, method })

    if (!isAp2Enabled()) {
      return errorResponse(
        'AP2 payments are not configured on this SettleGrid instance.',
        503,
        'AP2_NOT_CONFIGURED',
      )
    }

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
      return errorResponse('Tool not found or not active.', 404, 'TOOL_NOT_FOUND')
    }

    const costCents = resolveCostCents(toolRow.pricingConfig, method)
    const credential =
      typeof paymentContext.payment.proof === 'string'
        ? paymentContext.payment.proof
        : null

    // Verify-first (mirrors /api/x402/settle): a VDC that fails here after
    // passing /verify means it expired or was swapped in the interim.
    const verification = await validateAp2CredentialString(credential, {
      slug: toolRow.slug,
      costCents,
      displayName: toolRow.name,
      merchantId: 'settlegrid_platform',
    })

    if (!verification.valid) {
      logger.info('ap2.settle_rejected', {
        toolSlug,
        method,
        code: verification.error?.code,
      })
      return errorResponse(
        verification.error?.message ?? 'AP2 payment verification failed.',
        402,
        verification.error?.code ?? 'AP2_PAYMENT_FAILED',
      )
    }

    const settlement = {
      status: 'settled' as const,
      operationId: verification.transactionId ?? randomUUID(),
      costCents,
      metadata: {
        protocol: 'ap2' as const,
        latencyMs,
        settlementType: 'real-time' as const,
      },
    }

    logger.info('ap2.settle_success', {
      toolSlug,
      method,
      operationId: settlement.operationId,
      costCents,
    })

    return successResponse(settlement)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
