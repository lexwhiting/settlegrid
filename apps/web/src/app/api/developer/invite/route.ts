import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { developers, signupInvites } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * GET /api/developer/invite — returns the developer's invite link and stats
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `dev-invite:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const userRl = await checkRateLimit(apiLimiter, `dev-invite:uid:${auth.id}`)
    if (!userRl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Fetch developer's invite code (generate if missing)
    const [dev] = await db
      .select({
        id: developers.id,
        inviteCode: developers.inviteCode,
        bonusOpsBalance: developers.bonusOpsBalance,
      })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    if (!dev) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    let inviteCode = dev.inviteCode

    // Generate invite code if one does not exist yet
    if (!inviteCode) {
      inviteCode = `inv_${randomBytes(12).toString('hex')}`
      await db
        .update(developers)
        .set({ inviteCode, updatedAt: new Date() })
        .where(eq(developers.id, auth.id))
    }

    // Count successful invites
    const inviteStats = await db
      .select({
        totalInvites: sql<number>`count(*)::int`,
        totalBonusOps: sql<number>`coalesce(sum(${signupInvites.bonusOps}), 0)::int`,
      })
      .from(signupInvites)
      .where(eq(signupInvites.inviterId, auth.id))

    const totalInvites = inviteStats[0]?.totalInvites ?? 0
    const totalBonusOps = inviteStats[0]?.totalBonusOps ?? 0

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'
    const inviteUrl = `${baseUrl}/register?ref=${inviteCode}`

    return successResponse({
      inviteCode,
      inviteUrl,
      totalInvites,
      bonusOpsEarned: totalBonusOps,
      bonusOpsBalance: dev.bonusOpsBalance,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

// There is deliberately no POST handler: signup referrals are applied server-side in
// app/auth/callback/route.ts (processSignupInvite).
