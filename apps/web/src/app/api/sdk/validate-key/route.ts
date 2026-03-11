import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys, tools, consumerToolBalances, developers } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit, checkTieredRateLimit } from '@/lib/rate-limit'
import { isIpInAllowlist } from '@/lib/ip-validation'

export const maxDuration = 15

const validateKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  toolSlug: z.string().min(1, 'Tool slug is required'),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

    // Fast global rate limit guard
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
        ipAllowlist: apiKeys.ipAllowlist,
        isTestKey: apiKeys.isTestKey,
        developerId: tools.developerId,
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

    // Check IP allowlist
    const allowlist = row.ipAllowlist as string[] | null
    if (allowlist && allowlist.length > 0) {
      if (!isIpInAllowlist(ip, allowlist)) {
        return successResponse({ valid: false, reason: 'IP_NOT_ALLOWED' })
      }
    }

    // Look up developer tier for tiered rate limiting
    const [dev] = await db
      .select({ tier: developers.tier })
      .from(developers)
      .where(eq(developers.id, row.developerId))
      .limit(1)

    const tier = dev?.tier ?? 'free'

    // Apply tiered rate limit
    const tieredRl = await checkTieredRateLimit(`sdk-validate:${row.consumerId}`, tier, 'sdk')
    if (!tieredRl.success) {
      return errorResponse('Too many requests for your plan tier.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // For test keys, return unlimited virtual balance
    if (row.isTestKey) {
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
        balanceCents: 999999,
        isTestKey: true,
      })
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
      isTestKey: false,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
