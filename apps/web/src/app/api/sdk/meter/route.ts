import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, consumers, consumerToolBalances, invocations, apiKeys } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { sdkLimiter, checkRateLimit, checkTieredRateLimit } from '@/lib/rate-limit'
import { checkBudget, deductCreditsRedis, recordInvocationAsync, incrementPeriodSpend } from '@/lib/metering'
import { detectFraud } from '@/lib/fraud'
import { logger } from '@/lib/logger'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'
import { suspiciousActivityEmail } from '@/lib/email'
import { sendNotificationEmail } from '@/lib/notifications'
import { getRedis, tryRedis } from '@/lib/redis'

/** Monthly ops limits per tier */
const TIER_OPS_LIMITS: Record<string, number> = {
  standard: 25_000,
  starter: 100_000,
  growth: 500_000,
  scale: 2_000_000,
  enterprise: 10_000_000,
}

/** Platform fee rate applied when free-tier developer exceeds monthly ops limit */
const OVERAGE_REVENUE_SHARE_PCT = 95 // developer keeps 95%, platform takes 5%

export const maxDuration = 60
export { corsOptions as OPTIONS }


const meterSchema = z.object({
  toolSlug: z.string().min(1, 'Tool slug is required'),
  consumerId: z.string().uuid('Invalid consumer ID'),
  toolId: z.string().uuid('Invalid tool ID'),
  keyId: z.string().uuid('Invalid key ID'),
  method: z.string().min(1, 'Method is required').max(200),
  costCents: z.number().int().min(0, 'Cost must be non-negative'),
  latencyMs: z.number().int().min(0).optional(),
  isTestKey: z.boolean().optional(),
  referralCode: z.string().optional(),
})

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

    // ── Tiered rate limiting: look up developer tier for the tool ────────────
    // First try flat rate limit as a fast guard
    const rateLimit = await checkRateLimit(sdkLimiter, `sdk-meter:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, meterSchema)

    // ── Look up developer tier for tiered rate limiting ─────────────────────
    const [toolDev] = await db
      .select({
        developerId: tools.developerId,
        revenueSharePct: developers.revenueSharePct,
        developerTier: developers.tier,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!toolDev) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // ── Overage fee: apply 5% platform fee when free-tier devs exceed ops limit ─
    let effectiveRevenueSharePct = toolDev.revenueSharePct
    const tier = toolDev.developerTier ?? 'standard'
    const tierLimit = TIER_OPS_LIMITS[tier] ?? TIER_OPS_LIMITS.standard

    if (effectiveRevenueSharePct === 100 && tier === 'standard') {
      // Free tier — check if over monthly ops limit using Redis counter
      const redis = getRedis()
      const now = new Date()
      const monthKey = `dev-ops:${toolDev.developerId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthOps = await tryRedis(() => redis.get<number>(monthKey))

      if (monthOps !== null && monthOps >= tierLimit) {
        // Over limit — apply platform fee on this invocation
        effectiveRevenueSharePct = OVERAGE_REVENUE_SHARE_PCT
        logger.info('meter.overage_fee_applied', {
          developerId: toolDev.developerId,
          tier,
          monthOps,
          tierLimit,
          effectiveRevenueSharePct,
        })
      }

      // Increment the monthly ops counter (fire-and-forget)
      tryRedis(async () => {
        const ttl = 33 * 24 * 60 * 60 // 33 days — covers any month + buffer
        const exists = await redis.exists(monthKey)
        await redis.incr(monthKey)
        if (!exists) await redis.expire(monthKey, ttl)
      })
    }

    // Apply tiered rate limit based on developer's plan
    const tieredRl = await checkTieredRateLimit(
      `sdk-meter:${body.consumerId}`,
      toolDev.developerTier ?? 'free',
      'sdk'
    )
    if (!tieredRl.success) {
      return errorResponse('Too many requests for your plan tier.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // ── Test mode: skip all billing, record invocation with isTest=true ───────
    if (body.isTestKey) {
      // Verify the key is actually a test key (don't trust client blindly)
      const [keyRecord] = await db
        .select({ isTestKey: apiKeys.isTestKey })
        .from(apiKeys)
        .where(eq(apiKeys.id, body.keyId))
        .limit(1)

      if (keyRecord?.isTestKey) {
        // Record invocation but don't charge
        const [invocation] = await db
          .insert(invocations)
          .values({
            toolId: body.toolId,
            consumerId: body.consumerId,
            apiKeyId: body.keyId,
            method: body.method,
            costCents: 0,
            latencyMs: body.latencyMs ?? null,
            status: 'success',
            isTest: true,
          })
          .returning({ id: invocations.id })

        // Increment tool invocation count (but not revenue)
        await db
          .update(tools)
          .set({
            totalInvocations: sql`${tools.totalInvocations} + 1`,
            updatedAt: sql`${new Date().toISOString()}::timestamptz`,
          })
          .where(eq(tools.id, body.toolId))

        return successResponse({
          success: true,
          remainingBalanceCents: 999999,
          costCents: 0,
          invocationId: invocation.id,
          billed: false,
          reason: 'TEST_MODE',
        })
      }
      // If key is not actually a test key, fall through to normal billing
    }

    // If costCents is 0, skip balance deduction but still record the invocation
    if (body.costCents === 0) {
      const [invocation] = await db
        .insert(invocations)
        .values({
          toolId: body.toolId,
          consumerId: body.consumerId,
          apiKeyId: body.keyId,
          method: body.method,
          costCents: 0,
          latencyMs: body.latencyMs ?? null,
          status: 'success',
          referralCode: body.referralCode ?? null,
        })
        .returning({ id: invocations.id })

      // Increment tool invocation count
      await db
        .update(tools)
        .set({
          totalInvocations: sql`${tools.totalInvocations} + 1`,
          updatedAt: sql`${new Date().toISOString()}::timestamptz`,
        })
        .where(eq(tools.id, body.toolId))

      return successResponse({
        success: true,
        remainingBalanceCents: 0,
        costCents: 0,
        invocationId: invocation.id,
      })
    }

    // ── Fraud detection ──────────────────────────────────────────────────────
    // Look up key creation date and last-used date for fraud signals
    const [keyInfo] = await db
      .select({ createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, body.keyId))
      .limit(1)

    const fraudResult = await detectFraud({
      consumerId: body.consumerId,
      toolId: body.toolId,
      costCents: body.costCents,
      ip,
      keyId: body.keyId,
      keyCreatedAt: keyInfo?.createdAt ? new Date(keyInfo.createdAt) : undefined,
      keyLastUsedAt: keyInfo?.lastUsedAt ? new Date(keyInfo.lastUsedAt) : null,
      method: body.method,
    })

    // If risk score > 95, reject the request entirely
    if (fraudResult.riskScore > 95) {
      logger.warn('fraud.rejected', {
        consumerId: body.consumerId,
        toolId: body.toolId,
        costCents: body.costCents,
        ip,
        riskScore: fraudResult.riskScore,
        reasons: fraudResult.reasons,
      })
      return errorResponse('Request blocked due to suspicious activity.', 429, 'FRAUD_DETECTED')
    }

    // If risk score > 80, log warning but allow + notify consumer
    if (fraudResult.riskScore > 80) {
      logger.warn('fraud.flagged', {
        consumerId: body.consumerId,
        toolId: body.toolId,
        costCents: body.costCents,
        ip,
        riskScore: fraudResult.riskScore,
        reasons: fraudResult.reasons,
      })

      // Fire-and-forget: notify the consumer about suspicious activity (critical — always sent)
      db.select({ email: consumers.email })
        .from(consumers)
        .where(eq(consumers.id, body.consumerId))
        .limit(1)
        .then(([consumer]) => {
          if (consumer?.email) {
            const tmpl = suspiciousActivityEmail(consumer.email, fraudResult.reasons, fraudResult.riskScore)
            sendNotificationEmail({
              developerId: toolDev.developerId,
              eventKey: 'suspicious_activity',
              email: consumer.email,
              subject: tmpl.subject,
              html: tmpl.html,
              critical: true,
            }).catch(() => {})
          }
        })
        .catch(() => {})
    }

    // ── Budget check ──────────────────────────────────────────────────────────
    const budgetResult = await checkBudget(body.consumerId, body.toolId, body.costCents)
    if (!budgetResult.allowed) {
      return errorResponse(
        'Spending budget exceeded for this billing period.',
        402,
        'BUDGET_EXCEEDED'
      )
    }

    // ── Try Redis-accelerated deduction (fast path) ───────────────────────────
    const redisRemaining = await deductCreditsRedis(body.consumerId, body.toolId, body.costCents)

    if (redisRemaining !== null) {
      // Redis deduction succeeded — fire-and-forget DB writeback
      recordInvocationAsync({
        toolId: body.toolId,
        consumerId: body.consumerId,
        keyId: body.keyId,
        method: body.method,
        costCents: body.costCents,
        latencyMs: body.latencyMs ?? null,
        developerId: toolDev.developerId,
        revenueSharePct: effectiveRevenueSharePct,
        referralCode: body.referralCode,
        isFlagged: fraudResult.flagged,
      })

      // Track budget spend
      incrementPeriodSpend(body.consumerId, body.toolId, body.costCents)

      // Fire-and-forget: mark tool as verified after first real invocation
      markToolVerified(body.toolId)

      return successResponse({
        success: true,
        remainingBalanceCents: redisRemaining,
        costCents: body.costCents,
        isFlagged: fraudResult.flagged || undefined,
      })
    }

    // ── DB-only fallback (Redis unavailable or no cached balance) ─────────────
    const [balance] = await db
      .select({
        id: consumerToolBalances.id,
        balanceCents: consumerToolBalances.balanceCents,
      })
      .from(consumerToolBalances)
      .where(
        and(
          eq(consumerToolBalances.consumerId, body.consumerId),
          eq(consumerToolBalances.toolId, body.toolId)
        )
      )
      .limit(1)

    if (!balance || balance.balanceCents < body.costCents) {
      return errorResponse('Insufficient credits.', 402, 'INSUFFICIENT_CREDITS')
    }

    const developerShareCents = Math.floor(body.costCents * (effectiveRevenueSharePct / 100))

    // Atomic DB deduction
    const [updatedBalance] = await db
      .update(consumerToolBalances)
      .set({
        balanceCents: sql`${consumerToolBalances.balanceCents} - ${body.costCents}`,
        currentPeriodSpendCents: sql`${consumerToolBalances.currentPeriodSpendCents} + ${body.costCents}`,
      })
      .where(
        and(
          eq(consumerToolBalances.id, balance.id),
          sql`${consumerToolBalances.balanceCents} >= ${body.costCents}`
        )
      )
      .returning({ balanceCents: consumerToolBalances.balanceCents })

    if (!updatedBalance) {
      return errorResponse('Insufficient credits (race condition).', 402, 'INSUFFICIENT_CREDITS')
    }

    // Increment tool totalInvocations and totalRevenueCents
    const now = new Date()
    await db
      .update(tools)
      .set({
        totalInvocations: sql`${tools.totalInvocations} + 1`,
        totalRevenueCents: sql`${tools.totalRevenueCents} + ${body.costCents}`,
        updatedAt: sql`${now.toISOString()}::timestamptz`,
      })
      .where(eq(tools.id, body.toolId))

    // Add developer share
    await db
      .update(developers)
      .set({
        balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
        updatedAt: sql`${now.toISOString()}::timestamptz`,
      })
      .where(eq(developers.id, toolDev.developerId))

    // Insert invocation record (with fraud flag if applicable)
    const [invocation] = await db
      .insert(invocations)
      .values({
        toolId: body.toolId,
        consumerId: body.consumerId,
        apiKeyId: body.keyId,
        method: body.method,
        costCents: body.costCents,
        latencyMs: body.latencyMs ?? null,
        status: 'success',
        referralCode: body.referralCode ?? null,
        isFlagged: fraudResult.flagged,
      })
      .returning({ id: invocations.id })

    // Credit referral commission if applicable
    if (body.referralCode && body.costCents > 0) {
      const { creditReferralCommission } = await import('@/lib/metering')
      creditReferralCommission(body.referralCode, body.costCents)
    }

    // Fire-and-forget: mark tool as verified after first real invocation
    markToolVerified(body.toolId)

    return successResponse({
      success: true,
      remainingBalanceCents: updatedBalance.balanceCents,
      costCents: body.costCents,
      invocationId: invocation.id,
      isFlagged: fraudResult.flagged || undefined,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
})

/**
 * Fire-and-forget: set verified = true on a tool after its first real (non-test) invocation.
 * Uses a conditional update so it only writes once (when verified is still false).
 */
function markToolVerified(toolId: string): void {
  db.update(tools)
    .set({ verified: true })
    .where(and(eq(tools.id, toolId), eq(tools.verified, false)))
    .then(() => {})
    .catch(() => {})
}
