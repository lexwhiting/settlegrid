import { NextRequest } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { referrals, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developer/referrals/[id] — referral stats */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-referrals:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid referral ID.', 400, 'INVALID_ID')
    }

    const [referral] = await db
      .select({
        id: referrals.id,
        referredToolId: referrals.referredToolId,
        toolName: tools.name,
        referralCode: referrals.referralCode,
        commissionPct: referrals.commissionPct,
        totalEarnedCents: referrals.totalEarnedCents,
        status: referrals.status,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .innerJoin(tools, eq(referrals.referredToolId, tools.id))
      .where(and(eq(referrals.id, id), eq(referrals.referrerId, auth.id)))
      .limit(1)

    if (!referral) {
      return errorResponse('Referral not found.', 404, 'NOT_FOUND')
    }

    // Count invocations attributed to this referral code
    const [stats] = await db
      .select({
        totalInvocations: sql<number>`count(*)::int`,
        totalRevenueCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        uniqueConsumers: sql<number>`count(distinct ${invocations.consumerId})::int`,
      })
      .from(invocations)
      .where(eq(invocations.referralCode, referral.referralCode))

    return successResponse({
      referral,
      stats: stats ?? { totalInvocations: 0, totalRevenueCents: 0, uniqueConsumers: 0 },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** DELETE /api/developer/referrals/[id] — revoke a referral */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-referrals:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid referral ID.', 400, 'INVALID_ID')
    }

    const [existing] = await db
      .select({ id: referrals.id, status: referrals.status })
      .from(referrals)
      .where(and(eq(referrals.id, id), eq(referrals.referrerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Referral not found.', 404, 'NOT_FOUND')
    }

    if (existing.status === 'revoked') {
      return errorResponse('Referral is already revoked.', 400, 'ALREADY_REVOKED')
    }

    const [updated] = await db
      .update(referrals)
      .set({ status: 'revoked' })
      .where(eq(referrals.id, id))
      .returning({
        id: referrals.id,
        status: referrals.status,
      })

    return successResponse({ referral: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
