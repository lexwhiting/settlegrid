import { NextRequest } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { referrals, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/developer/referrals/[id]/earnings — detailed referral earnings breakdown */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-referral-earnings:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid referral ID.', 400, 'INVALID_ID')
    }

    // Fetch the referral
    const [referral] = await db
      .select({
        id: referrals.id,
        referralCode: referrals.referralCode,
        commissionPct: referrals.commissionPct,
        totalEarnedCents: referrals.totalEarnedCents,
        status: referrals.status,
        referredToolId: referrals.referredToolId,
        toolName: tools.name,
      })
      .from(referrals)
      .innerJoin(tools, eq(referrals.referredToolId, tools.id))
      .where(and(eq(referrals.id, id), eq(referrals.referrerId, auth.id)))
      .limit(1)

    if (!referral) {
      return errorResponse('Referral not found.', 404, 'NOT_FOUND')
    }

    // Count total invocations attributed to this referral code
    const [totalStats] = await db
      .select({
        invocationCount: sql<number>`count(*)::int`,
      })
      .from(invocations)
      .where(eq(invocations.referralCode, referral.referralCode))

    // Count this month's earnings (invocations this month * commissionPct)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [monthStats] = await db
      .select({
        invocationCount: sql<number>`count(*)::int`,
        totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
      })
      .from(invocations)
      .where(
        and(
          eq(invocations.referralCode, referral.referralCode),
          sql`${invocations.createdAt} >= ${startOfMonth}`
        )
      )

    const earnedThisMonthCents = Math.floor(
      (monthStats?.totalCostCents ?? 0) * referral.commissionPct / 100
    )

    return successResponse({
      referralId: referral.id,
      toolName: referral.toolName,
      commissionPct: referral.commissionPct,
      status: referral.status,
      totalEarnedCents: referral.totalEarnedCents,
      earnedThisMonthCents,
      totalInvocations: totalStats?.invocationCount ?? 0,
      thisMonthInvocations: monthStats?.invocationCount ?? 0,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
