import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { referrals, tools, invocations } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60


const createReferralSchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
  commissionPct: z.number().int().min(1).max(50).default(10),
})

/** GET /api/developer/referrals — list developer's referrals */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-referrals:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-referrals:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const devReferrals = await db
      .select({
        id: referrals.id,
        referredToolId: referrals.referredToolId,
        toolName: tools.name,
        toolSlug: tools.slug,
        referralCode: referrals.referralCode,
        commissionPct: referrals.commissionPct,
        totalEarnedCents: referrals.totalEarnedCents,
        status: referrals.status,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .innerJoin(tools, eq(referrals.referredToolId, tools.id))
      .where(eq(referrals.referrerId, auth.id))
      .limit(100)

    // This month's commission per referral (same basis as
    // /api/developer/referrals/[id]/earnings): attributed invocation cost × commissionPct
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthCostByCode = new Map<string, number>()
    const codes = devReferrals.map((r) => r.referralCode)
    if (codes.length > 0) {
      const monthRows = await db
        .select({
          referralCode: invocations.referralCode,
          totalCostCents: sql<number>`coalesce(sum(${invocations.costCents}), 0)::int`,
        })
        .from(invocations)
        .where(
          and(
            inArray(invocations.referralCode, codes),
            sql`${invocations.createdAt} >= ${startOfMonth}`
          )
        )
        .groupBy(invocations.referralCode)
      for (const row of monthRows) {
        if (row.referralCode) monthCostByCode.set(row.referralCode, Number(row.totalCostCents) || 0)
      }
    }

    return successResponse({
      referrals: devReferrals.map((r) => ({
        ...r,
        earnedThisMonthCents: Math.floor(
          (monthCostByCode.get(r.referralCode) ?? 0) * r.commissionPct / 100
        ),
      })),
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** POST /api/developer/referrals — create a referral link */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-referrals:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-referrals:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const body = await parseBody(request, createReferralSchema)

    // Verify tool exists and is active
    const [tool] = await db
      .select({ id: tools.id, name: tools.name })
      .from(tools)
      .where(and(eq(tools.id, body.toolId), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Check for existing active referral for this tool
    const [existing] = await db
      .select({ id: referrals.id })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, auth.id),
          eq(referrals.referredToolId, body.toolId),
          eq(referrals.status, 'active')
        )
      )
      .limit(1)

    if (existing) {
      return errorResponse('Active referral already exists for this tool.', 409, 'REFERRAL_EXISTS')
    }

    const referralCode = `ref_${randomBytes(12).toString('hex')}`

    const [referral] = await db
      .insert(referrals)
      .values({
        referrerId: auth.id,
        referredToolId: body.toolId,
        referralCode,
        commissionPct: body.commissionPct,
      })
      .returning({
        id: referrals.id,
        referredToolId: referrals.referredToolId,
        referralCode: referrals.referralCode,
        commissionPct: referrals.commissionPct,
        status: referrals.status,
        createdAt: referrals.createdAt,
      })

    return successResponse({ referral }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
