/**
 * Circle Nanopayments facilitator — settle route (P5 kernel-dispatch, Tier 1).
 *
 * Called by the SDK dispatch kernel's `handleFacilitatorProtocol` as
 *   POST ${apiUrl}/api/circle-nano/settle
 *   { toolSlug, paymentContext, handlerResult, latencyMs, method }
 * and expects a RAW SettlementResult body (status / operationId / costCents /
 * metadata) — see packages/mcp/src/kernel.ts `validateSettlementResult`.
 *
 * v1 is VERIFY-AND-RECORD: re-verify the EIP-3009 authorization offline
 * (verify-first, mirroring /api/{x402,ap2}/settle) and return the canonical
 * SettlementResult the adapter formats for the consumer. It does NOT submit
 * the transferWithAuthorization on-chain and does NOT write the unified ledger
 * — the SAME gap x402/mpp/ap2 settlement already have through the kernel
 * (deferred to P3.K4 router-wiring; circle-nano additionally defers on-chain
 * batch execution + nonce/balance enforcement). settlementType is 'batched'
 * to reflect the deferred on-chain batch; no txHash is set, so the adapter
 * reports settlementStatus 'off-chain-confirmed'. (Tracked as DEBT in
 * docs/tech-debt/circle-nano-kernel-dispatch-*.md.)
 *
 * Money-safety: identical to the verify route — the demo reaches the
 * /api/demo/sandbox stub, never this route.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { resolveOperationCost, parseCircleNanoProof } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isCircleNanoKernelEnabled } from '@/lib/env'
import { validateCircleNanoCredentialString } from '@/lib/circle-nano-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { recordSettlementEntryAsync } from '@/lib/settlement/ledger'

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
  // Accepted for contract-completeness; circle-nano cost is the tool's
  // registered per-invocation price, not handler-derived, so this is not read.
  handlerResult: z.unknown().optional(),
})

/**
 * See the identical helper in ../verify/route.ts. Inlined (not shared via a
 * lib) to match the repo's existing per-route cost-resolution pattern.
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
    const rateLimit = await checkRateLimit(apiLimiter, `circle-nano-settle:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, settleSchema)
    const { toolSlug, method, paymentContext } = body
    const latencyMs = typeof body.latencyMs === 'number' ? body.latencyMs : 0

    logger.info('circle_nano.settle_request', { toolSlug, method })

    if (!isCircleNanoKernelEnabled()) {
      return errorResponse(
        'Circle Nanopayments are not configured on this SettleGrid instance.',
        503,
        'CIRCLE_NANO_NOT_CONFIGURED',
      )
    }

    const [toolRow] = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        status: tools.status,
        pricingConfig: tools.pricingConfig,
        developerId: tools.developerId,
      })
      .from(tools)
      .where(eq(tools.slug, toolSlug))
      .limit(1)

    if (!toolRow || toolRow.status !== 'active') {
      return errorResponse('Tool not found or not active.', 404, 'TOOL_NOT_FOUND')
    }

    const costCents = resolveCostCents(toolRow.pricingConfig, method)
    const proof =
      typeof paymentContext.payment.proof === 'string'
        ? paymentContext.payment.proof
        : null

    // Verify-first (mirrors /api/{x402,ap2}/settle): an authorization that
    // fails here after passing /verify means it expired or was swapped in the
    // interim.
    const verification = await validateCircleNanoCredentialString(proof, {
      slug: toolRow.slug,
      costCents,
      displayName: toolRow.name,
    })

    if (!verification.valid) {
      logger.info('circle_nano.settle_rejected', {
        toolSlug,
        method,
        code: verification.error?.code,
      })
      return errorResponse(
        verification.error?.message ?? 'Circle Nanopayment verification failed.',
        402,
        verification.error?.code ?? 'CIRCLE_NANO_AUTH_INVALID',
      )
    }

    const settlement = {
      status: 'settled' as const,
      operationId: randomUUID(),
      costCents,
      metadata: {
        protocol: 'circle-nano' as const,
        latencyMs,
        // 'batched': on-chain batch settlement is deferred (P3.K4). No txHash
        // is set, so the adapter's formatResponse reports the honest
        // 'off-chain-confirmed' rather than claiming an on-chain transfer.
        settlementType: 'batched' as const,
      },
    }

    logger.info('circle_nano.settle_success', {
      toolSlug,
      method,
      operationId: settlement.operationId,
      costCents,
    })

    // P3.K4 (A1) — record the settlement to the unified ledger. circle-nano is
    // verify-and-record today (on-chain submission is deferred to A2), so the
    // row is honestly 'pending' — the USDC has NOT moved on-chain yet. The
    // invocationId is the STABLE network:from:nonce identifier (NOT the random
    // SettlementResult.operationId): it names the AUTHORIZATION, not the call,
    // so the writer's deterministic-id + ON CONFLICT DO NOTHING makes a re-settle
    // idempotent (exactly one row per authorization). A2 flips this row to
    // 'settled' + the on-chain txHash via an explicit UPDATE (NOT a re-insert,
    // which the conflict-guard would skip). circle-nano is also gated DARK in
    // prod (SETTLEGRID_USDC_RECIPIENT unset → 503 above) until A2. accountId =
    // the tool's owning developer. See
    // docs/tech-debt/a1-facilitator-ledger-writes-2026-05-30.md.
    if (costCents > 0 && toolRow.developerId) {
      const parsedProof = proof ? parseCircleNanoProof(proof) : null
      if (parsedProof) {
        const { network, authorization } = parsedProof
        recordSettlementEntryAsync({
          invocationId: `circle-nano:${network}:${authorization.from.toLowerCase()}:${authorization.nonce.toLowerCase()}`,
          rail: 'circle-nano',
          protocol: 'circle-nano',
          amountCents: costCents,
          currency: 'USDC',
          takeBps: 0,
          status: 'pending',
          externalRef: null,
          accountId: toolRow.developerId,
          metadata: {
            method,
            settlementType: 'batched',
            network,
            payer: authorization.from,
          },
          description: `circle-nano settlement for tool ${toolRow.slug} (${method})`,
        })
      }
    }

    return successResponse(settlement)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
