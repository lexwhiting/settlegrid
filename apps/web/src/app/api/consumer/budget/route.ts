import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumerToolBalances, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 15

const updateBudgetSchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
  spendingLimitCents: z.number().int().min(100, 'Minimum spending limit is 100 cents').optional(),
  spendingLimitPeriod: z.enum(['daily', 'weekly', 'monthly']).optional(),
  alertAtPct: z.number().int().min(1).max(100).optional(),
})

function computePeriodResetAt(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date()
  switch (period) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `budget-list:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const budgets = await db
      .select({
        id: consumerToolBalances.id,
        toolId: consumerToolBalances.toolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        balanceCents: consumerToolBalances.balanceCents,
        spendingLimitCents: consumerToolBalances.spendingLimitCents,
        spendingLimitPeriod: consumerToolBalances.spendingLimitPeriod,
        currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
        periodResetAt: consumerToolBalances.periodResetAt,
        alertAtPct: consumerToolBalances.alertAtPct,
      })
      .from(consumerToolBalances)
      .innerJoin(tools, eq(consumerToolBalances.toolId, tools.id))
      .where(eq(consumerToolBalances.consumerId, auth.id))
      .limit(500)

    return successResponse({ budgets })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `budget-update:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, updateBudgetSchema)

    // Verify balance record exists and belongs to consumer
    const [existing] = await db
      .select({ id: consumerToolBalances.id })
      .from(consumerToolBalances)
      .where(
        and(
          eq(consumerToolBalances.consumerId, auth.id),
          eq(consumerToolBalances.toolId, body.toolId)
        )
      )
      .limit(1)

    if (!existing) {
      return errorResponse('No balance found for this tool.', 404, 'NOT_FOUND')
    }

    const updateData: Record<string, unknown> = {}
    if (body.spendingLimitCents !== undefined) updateData.spendingLimitCents = body.spendingLimitCents
    if (body.alertAtPct !== undefined) updateData.alertAtPct = body.alertAtPct
    if (body.spendingLimitPeriod !== undefined) {
      updateData.spendingLimitPeriod = body.spendingLimitPeriod
      updateData.periodResetAt = computePeriodResetAt(body.spendingLimitPeriod)
      updateData.currentPeriodSpendCents = 0
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields to update.', 400, 'NO_UPDATES')
    }

    const [updated] = await db
      .update(consumerToolBalances)
      .set(updateData)
      .where(eq(consumerToolBalances.id, existing.id))
      .returning({
        id: consumerToolBalances.id,
        toolId: consumerToolBalances.toolId,
        spendingLimitCents: consumerToolBalances.spendingLimitCents,
        spendingLimitPeriod: consumerToolBalances.spendingLimitPeriod,
        currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
        periodResetAt: consumerToolBalances.periodResetAt,
        alertAtPct: consumerToolBalances.alertAtPct,
      })

    return successResponse({ budget: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
