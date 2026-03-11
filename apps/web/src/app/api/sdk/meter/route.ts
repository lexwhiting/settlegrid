import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, consumerToolBalances, invocations, apiKeys } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { sdkLimiter, checkRateLimit, checkTieredRateLimit } from '@/lib/rate-limit'
import { checkBudget, deductCreditsRedis, recordInvocationAsync, incrementPeriodSpend } from '@/lib/metering'
import { detectFraud } from '@/lib/fraud'
import { logger } from '@/lib/logger'

export const maxDuration = 15

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

export async function POST(request: NextRequest) {
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
            updatedAt: new Date(),
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
          updatedAt: new Date(),
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
    // Look up key creation date for new-key check
    const [keyInfo] = await db
      .select({ createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, body.keyId))
      .limit(1)

    const fraudResult = await detectFraud(
      body.consumerId,
      body.toolId,
      body.costCents,
      ip,
      keyInfo?.createdAt ? new Date(keyInfo.createdAt) : undefined
    )

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

    // If risk score > 80, log warning but allow
    if (fraudResult.riskScore > 80) {
      logger.warn('fraud.flagged', {
        consumerId: body.consumerId,
        toolId: body.toolId,
        costCents: body.costCents,
        ip,
        riskScore: fraudResult.riskScore,
        reasons: fraudResult.reasons,
      })
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
        revenueSharePct: toolDev.revenueSharePct,
        referralCode: body.referralCode,
        isFlagged: fraudResult.flagged,
      })

      // Track budget spend
      incrementPeriodSpend(body.consumerId, body.toolId, body.costCents)

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

    const developerShareCents = Math.floor(body.costCents * (toolDev.revenueSharePct / 100))

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
    await db
      .update(tools)
      .set({
        totalInvocations: sql`${tools.totalInvocations} + 1`,
        totalRevenueCents: sql`${tools.totalRevenueCents} + ${body.costCents}`,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, body.toolId))

    // Add developer share
    await db
      .update(developers)
      .set({
        balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
        updatedAt: new Date(),
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
}
