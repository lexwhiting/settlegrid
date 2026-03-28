import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { developers, signupInvites } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const BONUS_OPS_PER_INVITE = 5000

/**
 * GET /api/developer/invite — returns the developer's invite link and stats
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-invite:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

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

const processInviteSchema = z.object({
  inviteCode: z.string().regex(/^inv_[0-9a-f]{24}$/, 'Invalid invite code format'),
  newDeveloperId: z.string().uuid('Invalid developer ID'),
})

/**
 * POST /api/developer/invite — process a signup referral
 *
 * Called internally after a new developer account is created.
 * Credits bonus ops to both the referrer and the new signup.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-invite:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const body = await parseBody(request, processInviteSchema)
    const { inviteCode, newDeveloperId } = body

    // Validate invite code belongs to an active developer
    const [referrer] = await db
      .select({ id: developers.id, email: developers.email })
      .from(developers)
      .where(eq(developers.inviteCode, inviteCode))
      .limit(1)

    if (!referrer) {
      return errorResponse('Invalid invite code.', 404, 'INVALID_INVITE_CODE')
    }

    // Prevent self-referral
    if (referrer.id === newDeveloperId) {
      return errorResponse('Cannot refer yourself.', 400, 'SELF_REFERRAL')
    }

    // Check that the new developer exists
    const [newDev] = await db
      .select({ id: developers.id })
      .from(developers)
      .where(eq(developers.id, newDeveloperId))
      .limit(1)

    if (!newDev) {
      return errorResponse('New developer not found.', 404, 'DEVELOPER_NOT_FOUND')
    }

    // Check if this developer was already referred (idempotency)
    const existingInvites = await db
      .select({ id: signupInvites.id })
      .from(signupInvites)
      .where(eq(signupInvites.inviteeId, newDeveloperId))
      .limit(1)

    if (existingInvites.length > 0) {
      return errorResponse('Developer was already referred.', 409, 'ALREADY_REFERRED')
    }

    // Atomic: create invite record + credit both parties in a single transaction
    await db.transaction(async (tx) => {
      await tx.insert(signupInvites).values({
        inviterId: referrer.id,
        inviteeId: newDeveloperId,
        bonusOps: BONUS_OPS_PER_INVITE,
        inviterCredited: true,
        inviteeCredited: true,
      })

      await tx
        .update(developers)
        .set({
          bonusOpsBalance: sql`${developers.bonusOpsBalance} + ${BONUS_OPS_PER_INVITE}`,
          updatedAt: new Date(),
        })
        .where(eq(developers.id, referrer.id))

      await tx
        .update(developers)
        .set({
          bonusOpsBalance: sql`${developers.bonusOpsBalance} + ${BONUS_OPS_PER_INVITE}`,
          referredByDeveloperId: referrer.id,
          updatedAt: new Date(),
        })
        .where(eq(developers.id, newDeveloperId))
    })

    logger.info('invite.processed', {
      referrerId: referrer.id,
      inviteeId: newDeveloperId,
      bonusOps: BONUS_OPS_PER_INVITE,
    })

    return successResponse({
      success: true,
      bonusOps: BONUS_OPS_PER_INVITE,
      referrerId: referrer.id,
      inviteeId: newDeveloperId,
    }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
