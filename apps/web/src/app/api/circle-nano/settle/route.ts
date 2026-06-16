/**
 * Circle Nanopayments facilitator — settle route (P5 kernel-dispatch, Tier 1).
 *
 * Called by the SDK dispatch kernel's `handleFacilitatorProtocol` as
 *   POST ${apiUrl}/api/circle-nano/settle
 *   { toolSlug, paymentContext, handlerResult, latencyMs, method }
 * and expects a RAW SettlementResult body (status / operationId / costCents /
 * metadata) — see packages/mcp/src/kernel.ts `validateSettlementResult`.
 *
 * P3.K4 A2 — this route now SETTLES REAL MONEY. It re-verifies the EIP-3009
 * authorization offline (verify-first, mirroring /api/{x402,ap2}/settle), then —
 * when the tool has a positive cost, an owning developer, and a parseable proof —
 * submits the transferWithAuthorization on-chain via the gas wallet, waits for a
 * CONFIRMED receipt, and flips the write-ahead 'pending' ledger row to its
 * terminal state (see lib/settlement/circle-nano/settle.ts). A settled on-chain
 * payment returns settlementType 'real-time' + the txHash (so the adapter reports
 * settlementStatus 'on-chain'); a reverted/unconfirmed tx returns a structured
 * HTTP error and is NEVER reported settled. Free / unattributable calls keep the
 * verify-and-record-only path (settled, no txHash). circle-nano stays DARK in
 * prod (SETTLEGRID_USDC_RECIPIENT unset → 503 above) until founder go-live. See
 * docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md.
 *
 * Money-safety: the demo reaches the /api/demo/sandbox stub, never this route —
 * so the demo never moves on-chain funds.
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { resolveOperationCost, parseCircleNanoProof } from '@settlegrid/mcp'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { isCircleNanoKernelEnabled, X402_MAINNET_NETWORK, isX402TestnetSettlementAllowed } from '@/lib/env'
import { validateCircleNanoCredentialString } from '@/lib/circle-nano-proxy'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { executeCircleNanoSettlement, circleNanoOperationId } from '@/lib/settlement/circle-nano/settle'
import { creditSettlement } from '@/lib/settlement/reconcile'

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
    const ip = getClientIp(request.headers)
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
        id: tools.id,
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

    // P3.K4 (A2) — REAL ON-CHAIN SETTLEMENT. When the tool has a positive cost,
    // an owning developer, and a parseable proof, submit the EIP-3009
    // transferWithAuthorization on-chain (gas wallet), wait for a CONFIRMED
    // receipt, and flip the write-ahead 'pending' ledger row to its terminal
    // state. A reverted or unconfirmed tx is NEVER reported as settled — it
    // surfaces as a structured HTTP error so the kernel routes through
    // formatError and the consumer is not told 'paid'. The orchestrator owns
    // idempotency (stable network:from:nonce key in operation_id), a write-ahead
    // pending INTENT row, a per-authorization lock, and the flip. See
    // lib/settlement/circle-nano/settle.ts +
    // docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md.
    const parsedProof = proof ? parseCircleNanoProof(proof) : null

    if (costCents > 0 && toolRow.developerId && parsedProof) {
      // F2 — production network-pin (mirror handleX402Proxy). The offline verifier
      // accepts ANY network in USDC_EIP712_DOMAINS (Base mainnet AND Sepolia), so on
      // a mainnet deploy a Sepolia payload would settle FREE testnet USDC yet credit
      // a real, withdrawable developer balance below. Hard-pin prod to Base mainnet;
      // testnet is accepted only in non-prod behind SETTLEGRID_X402_ALLOW_TESTNET
      // (the helper bakes in !isProduction(), so prod can never be re-opened by a
      // stray flag). Reuses x402's pin — both rails are Base USDC.
      if (parsedProof.network !== X402_MAINNET_NETWORK && !isX402TestnetSettlementAllowed()) {
        logger.warn('circle_nano.settle_network_unsupported', { toolSlug, network: parsedProof.network })
        return errorResponse(
          `Circle Nanopayment settlement requires the Base mainnet network (${X402_MAINNET_NETWORK}).`,
          402,
          'CIRCLE_NANO_NETWORK_UNSUPPORTED',
        )
      }

      const outcome = await executeCircleNanoSettlement({
        proof: parsedProof,
        costCents,
        accountId: toolRow.developerId,
        toolId: toolRow.id,
        toolSlug: toolRow.slug,
        method,
        latencyMs,
      })

      if (outcome.status !== 'settled') {
        // failed | pending — the USDC did not (confirmably) move. Surface a
        // structured error; never a 'settled' SettlementResult.
        logger.info('circle_nano.settle_not_settled', {
          toolSlug,
          method,
          outcomeStatus: outcome.status,
          code: outcome.code,
        })
        return errorResponse(outcome.reason, outcome.httpStatus, outcome.code)
      }

      // Credit the developer (the payout source of truth) + tool revenue for the
      // USDC just collected on-chain — EXACTLY ONCE, only on a FRESH flip. An
      // idempotent-hit / concurrent-loser (alreadySettled) was already credited by
      // the flip winner, and the async tail is credited by the reconciler; all three
      // gate on the single WHERE-pending flip, so one authorization credits once.
      // Keyed by the STABLE operation_id (NOT the response's randomUUID) so a
      // credit_failed/missing_toolid alert reconciles against the ledger row.
      // (V-N2b) — credit the ACTUALLY-collected value the orchestrator resolved
      // (fresh-submit = costCents; recovery-confirm = the prior broadcast's recorded
      // value, possibly ≠ costCents), NOT costCents. `creditCents == null` ⇒ DEFER:
      // skip the credit entirely (the row stays unmarked → the uncredited sweep
      // enumerates + alerts it for a runbook credit; the reconciler tail does NOT
      // re-credit an already-settled row) — never credit a guess on a recovery. The orchestrator
      // already emitted the differentiated legacy_fallback / unconvertible signal.
      if (outcome.alreadySettled !== true && outcome.creditCents != null) {
        await creditSettlement({
          developerId: toolRow.developerId,
          toolId: toolRow.id,
          amountCents: outcome.creditCents,
          operationId: circleNanoOperationId(parsedProof),
          // (T) — keys the credited_at marker written inside the credit txn.
          rail: 'circle-nano',
        })
      }

      const settlement = {
        status: 'settled' as const,
        operationId: randomUUID(),
        costCents,
        // Real on-chain settlement → the adapter's formatResponse derives
        // settlementStatus 'on-chain' from this txHash.
        txHash: outcome.txHash,
        metadata: {
          protocol: 'circle-nano' as const,
          latencyMs,
          // A2: synchronous on-chain settlement (was deferred 'batched').
          settlementType: 'real-time' as const,
        },
      }
      logger.info('circle_nano.settle_success', {
        toolSlug,
        method,
        operationId: settlement.operationId,
        costCents,
        txHash: outcome.txHash,
      })
      return successResponse(settlement)
    }

    // Free op (costCents <= 0) or unattributable (no owning developer / no
    // parseable proof): no USDC moves on-chain. Return an honest settled result
    // with NO txHash — the adapter reports settlementStatus 'off-chain-confirmed'.
    const settlement = {
      status: 'settled' as const,
      operationId: randomUUID(),
      costCents,
      metadata: {
        protocol: 'circle-nano' as const,
        latencyMs,
        settlementType: 'real-time' as const,
      },
    }
    logger.info('circle_nano.settle_success_free', {
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
