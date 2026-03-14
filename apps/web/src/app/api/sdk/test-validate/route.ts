import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys, tools } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { withCors, OPTIONS as corsOptions } from '@/lib/middleware/cors'

export const maxDuration = 60
export { corsOptions as OPTIONS }


const testValidateSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  toolSlug: z.string().min(1, 'Tool slug is required'),
})

/** POST /api/sdk/test-validate — validate test API keys (sg_test_ prefix) */
export const POST = withCors(async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `sdk-test-validate:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const body = await parseBody(request, testValidateSchema)

    // Enforce test key prefix
    if (!body.apiKey.startsWith('sg_test_')) {
      return successResponse({ valid: false, reason: 'Not a test API key. Use sg_test_ prefix.' })
    }

    const keyHash = hashApiKey(body.apiKey)

    // Look up the key, join with tool to verify slug
    const results = await db
      .select({
        keyId: apiKeys.id,
        keyStatus: apiKeys.status,
        consumerId: apiKeys.consumerId,
        toolId: apiKeys.toolId,
        isTestKey: apiKeys.isTestKey,
        toolSlug: tools.slug,
        toolStatus: tools.status,
      })
      .from(apiKeys)
      .innerJoin(tools, eq(apiKeys.toolId, tools.id))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1)

    if (results.length === 0) {
      return successResponse({ valid: false, reason: 'Invalid test API key.' })
    }

    const row = results[0]

    if (row.keyStatus !== 'active') {
      return successResponse({ valid: false, reason: 'Test API key has been revoked.' })
    }

    if (row.toolSlug !== body.toolSlug) {
      return successResponse({ valid: false, reason: 'API key does not match the specified tool.' })
    }

    // Test mode: always valid, no real balance check
    // Update lastUsedAt in the background (non-blocking)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.keyId))
      .then(() => {})
      .catch(() => {})

    return successResponse({
      valid: true,
      testMode: true,
      consumerId: row.consumerId,
      toolId: row.toolId,
      balanceCents: 999999,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
})
