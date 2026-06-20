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
import { after, NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { resolveOperationCost } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isAp2Enabled } from '@/lib/env'
import { validateAp2CredentialString } from '@/lib/ap2-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { recordSettlementEntry } from '@/lib/settlement/ledger'
// V-N3-log-redaction — `settlement.operationId` here is a synthetic randomUUID /
// VDC transactionId (NOT a payer-bearing op_id); `redactOpId` passes it through
// unchanged while satisfying the no-raw-op_id guard.
import { redactOpId } from '@/lib/settlement/log-redaction'

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
    const ip = getClientIp(request.headers)
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
        developerId: tools.developerId,
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
      operationId: redactOpId(settlement.operationId),
      costCents,
    })

    // P3.K4 (A1) — record the settlement to the unified ledger. AP2's VDC IS
    // the payment authorization (no external rail), so the row is honestly
    // 'settled' at validation. Durable (Vercel after()) + guarded: a ledger hiccup or a
    // zero-cost call never breaks the SettlementResult the kernel needs. The
    // write is idempotent by invocationId (= operationId = the VDC transactionId
    // when present) via the writer's deterministic-id + ON CONFLICT DO NOTHING,
    // so a settle retry for the same VDC does not double-record. accountId = the
    // tool's owning developer — `ledger_entries.account_id` has no FK and the
    // `accounts` table has no provisioning path to resolve a provider account
    // from (see docs/tech-debt/a1-facilitator-ledger-writes-2026-05-30.md).
    if (costCents > 0 && toolRow.developerId) {
      // Durable best-effort: after() keeps the Fluid invocation alive until the
      // write settles (off the response critical path), so a serverless freeze
      // can't drop this audit row (A1 debt #3 — the fire-and-forget hole). The
      // callback RETURNS the write's promise so after() awaits it; wrapping the
      // void-returning recordSettlementEntryAsync would give after() nothing to
      // await (not durable). AP2 is a facilitator (no balance credit), so this is
      // an audit record, not funds; takeBps:0 is the correct settlement-time take
      // (the platform take is realized progressively at payout — lib/pricing.ts).
      after(() =>
        recordSettlementEntry({
          invocationId: settlement.operationId,
          rail: 'ap2',
          protocol: 'ap2',
          amountCents: costCents,
          currency: 'USD',
          takeBps: 0,
          status: 'settled',
          // A 'settled' row MUST carry settledAt — the canonical validator
          // (packages/mcp/src/ledger.ts) throws RangeError without it, backed by
          // the DB `ledger_entries_settled_at_shape` check. AP2 settles AT
          // validation (the VDC IS the payment), so "now" is the settlement time.
          settledAt: new Date().toISOString(),
          accountId: toolRow.developerId,
          metadata: { method, settlementType: 'real-time' },
          description: `ap2 settlement for tool ${toolRow.slug} (${method})`,
        }).catch((err) =>
          logger.error(
            'settlement.ledger_write_failed',
            { invocationId: redactOpId(settlement.operationId), rail: 'ap2', protocol: 'ap2' },
            err,
          ),
        ),
      )
    }

    return successResponse(settlement)
  } catch (error) {
    return internalErrorResponse(error)
  }
})
