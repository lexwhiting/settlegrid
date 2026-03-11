import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys, tools, consumerToolBalances } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 15

const validateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  toolSlug: z.string().min(1, 'Tool slug is required'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `sdk-validate:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, validateKeySchema)

    const keyHash = hashApiKey(body.apiKey)

    // Single query: look up the key, join with tool to verify slug + active status
    const results = await db
      .select({
        keyId: apiKeys.id,
        keyStatus: apiKeys.status,
        consumerId: apiKeys.consumerId,
        toolId: apiKeys.toolId,
        toolSlug: tools.slug,
        toolStatus: tools.status,
      })
      .from(apiKeys)
      .innerJoin(tools, eq(apiKeys.toolId, tools.id))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1)

    if (results.length === 0) {
      return successResponse({ valid: false, reason: 'Invalid API key.' })
    }

    const row = results[0]

    if (row.keyStatus !== 'active') {
      return successResponse({ valid: false, reason: 'API key has been revoked.' })
    }

    if (row.toolSlug !== body.toolSlug) {
      return successResponse({ valid: false, reason: 'API key does not match the specified tool.' })
    }

    if (row.toolStatus !== 'active') {
      return successResponse({ valid: false, reason: 'Tool is not active.' })
    }

    // Get consumer balance for this tool
    const [balance] = await db
      .select({ balanceCents: consumerToolBalances.balanceCents })
      .from(consumerToolBalances)
      .where(
        and(
          eq(consumerToolBalances.consumerId, row.consumerId),
          eq(consumerToolBalances.toolId, row.toolId)
        )
      )
      .limit(1)

    const balanceCents = balance?.balanceCents ?? 0

    // Update lastUsedAt in the background (non-blocking)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.keyId))
      .then(() => {})
      .catch(() => {})

    return successResponse({
      valid: true,
      consumerId: row.consumerId,
      toolId: row.toolId,
      keyId: row.keyId,
      balanceCents,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
