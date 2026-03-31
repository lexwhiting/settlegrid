import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { createOrganization, addMember } from '@/lib/settlement/organizations'
import { requireDeveloper } from '@/lib/middleware/auth'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 10

const createOrgSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(63, 'Slug too long')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Slug must be lowercase alphanumeric with hyphens, cannot start or end with hyphen'
    ),
  billingEmail: z.string().email('Invalid billing email'),
  plan: z.enum(['free', 'builder', 'scale', 'enterprise']).optional(),
})

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    // Require authenticated developer
    const developer = await requireDeveloper(request)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `orgs:create:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    // ── Tier gate: team_access requires Scale+ ─────────────────────────
    const [dev] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, developer.id))
      .limit(1)

    if (!dev) {
      return errorResponse('Developer account not found.', 404, 'NOT_FOUND', requestId)
    }

    if (!hasFeature(dev.tier, 'team_access', dev.isFoundingMember)) {
      return errorResponse(
        'This feature requires the Scale plan.',
        403,
        'TIER_REQUIRED',
        requestId,
        { requiredTier: 'scale', currentTier: dev.tier, upgradeUrl: '/pricing' }
      )
    }

    const body = await parseBody(request, createOrgSchema)

    const org = await createOrganization({
      name: body.name,
      slug: body.slug,
      billingEmail: body.billingEmail,
      plan: body.plan,
    })

    // Auto-add the authenticated developer as owner
    await addMember(org.id, developer.id, 'owner')

    logger.info('api.org.created', { orgId: org.id, slug: org.slug, developerId: developer.id })

    return successResponse(org, 201, requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED', requestId)
    }
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('Organization slug already exists', 409, 'SLUG_CONFLICT', requestId)
    }
    return internalErrorResponse(error, requestId)
  }
}
