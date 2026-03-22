import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, consumerToolBalances, invocations } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 60
export { corsOptions as OPTIONS }


const meterWithMetadataSchema = z.object({
  toolSlug: z.string().min(1, 'Tool slug is required'),
  consumerId: z.string().uuid('Invalid consumer ID'),
  toolId: z.string().uuid('Invalid tool ID'),
  keyId: z.string().uuid('Invalid key ID'),
  method: z.string().min(1, 'Method is required').max(200),
  costCents: z.number().int().min(0, 'Cost must be non-negative'),
  latencyMs: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const MAX_METADATA_BYTES = 1024

export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `sdk-meter-meta:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, meterWithMetadataSchema)

    // Validate metadata size if provided
    if (body.metadata !== undefined) {
      const metadataStr = JSON.stringify(body.metadata)
      if (new TextEncoder().encode(metadataStr).length > MAX_METADATA_BYTES) {
        return errorResponse(
          `Metadata must not exceed ${MAX_METADATA_BYTES} bytes.`,
          400,
          'METADATA_TOO_LARGE'
        )
      }
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
          isTest: false,
          metadata: body.metadata ?? null,
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

    // Dynamic revenue split based on developer tier (95% standard, 97% enterprise)
    const developerShareCents = Math.floor(body.costCents * (toolDev.revenueSharePct / 100))

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
      .where(eq(developers.id, toolDev.developerId))

    // 4. Insert invocation record with metadata
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
        isTest: false,
        metadata: body.metadata ?? null,
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
})
