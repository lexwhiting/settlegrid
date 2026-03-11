import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, consumerToolBalances, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'

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
    const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'
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

    // Check consumer balance for this tool
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
      return errorResponse(
        'Insufficient credits.',
        402,
        'INSUFFICIENT_CREDITS'
      )
    }

    // Get tool to find developer
    const [tool] = await db
      .select({ developerId: tools.developerId })
      .from(tools)
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Calculate 80/20 split: developer gets 80%, platform keeps 20%
    const developerShareCents = Math.floor(body.costCents * 0.8)

    // Execute all updates atomically using a transaction
    // Drizzle doesn't have a built-in transaction for postgres-js, so we do sequential ops
    // and rely on the atomic SQL operations

    // 1. Deduct from consumer balance (atomic)
    const [updatedBalance] = await db
      .update(consumerToolBalances)
      .set({
        balanceCents: sql`${consumerToolBalances.balanceCents} - ${body.costCents}`,
      })
      .where(
        and(
          eq(consumerToolBalances.id, balance.id),
          sql`${consumerToolBalances.balanceCents} >= ${body.costCents}`
        )
      )
      .returning({ balanceCents: consumerToolBalances.balanceCents })

    if (!updatedBalance) {
      return errorResponse(
        'Insufficient credits (race condition).',
        402,
        'INSUFFICIENT_CREDITS'
      )
    }

    // 2. Increment tool totalInvocations and totalRevenueCents
    await db
      .update(tools)
      .set({
        totalInvocations: sql`${tools.totalInvocations} + 1`,
        totalRevenueCents: sql`${tools.totalRevenueCents} + ${body.costCents}`,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, body.toolId))

    // 3. Add developer share to developer balance
    await db
      .update(developers)
      .set({
        balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, tool.developerId))

    // 4. Insert invocation record
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
