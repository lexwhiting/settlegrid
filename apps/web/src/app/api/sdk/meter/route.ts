import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, consumerToolBalances, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { checkBudget, deductCreditsRedis, recordInvocationAsync, incrementPeriodSpend } from '@/lib/metering'

export const maxDuration = 15

const meterSchema = z.object({
  toolSlug: z.string().min(1, 'Tool slug is required'),
  consumerId: z.string().uuid('Invalid consumer ID'),
  toolId: z.string().uuid('Invalid tool ID'),
  keyId: z.string().uuid('Invalid key ID'),
  method: z.string().min(1, 'Method is required').max(200),
  costCents: z.number().int().min(0, 'Cost must be non-negative'),
  latencyMs: z.number().int().min(0).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `sdk-meter:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, meterSchema)

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

    // ── Budget check ──────────────────────────────────────────────────────────
    const budgetResult = await checkBudget(body.consumerId, body.toolId, body.costCents)
    if (!budgetResult.allowed) {
      return errorResponse(
        'Spending budget exceeded for this billing period.',
        402,
        'BUDGET_EXCEEDED'
      )
    }

    // Get tool + developer to find revenue share percentage
    const [toolDev] = await db
      .select({
        developerId: tools.developerId,
        revenueSharePct: developers.revenueSharePct,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!toolDev) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
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
      })

      // Track budget spend
      incrementPeriodSpend(body.consumerId, body.toolId, body.costCents)

      return successResponse({
        success: true,
        remainingBalanceCents: redisRemaining,
        costCents: body.costCents,
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

    // Insert invocation record
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
      })
      .returning({ id: invocations.id })

    return successResponse({
      success: true,
      remainingBalanceCents: updatedBalance.balanceCents,
      costCents: body.costCents,
      invocationId: invocation.id,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
