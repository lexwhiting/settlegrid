import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 60

const updatePayoutSettingsSchema = z.object({
  payoutSchedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
  payoutMinimumCents: z.number().int().min(100).max(50000).optional(), // $1 minimum
})

/** PATCH /api/dashboard/developer/payout-settings — update payout schedule and minimum */
export async function PATCH(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-payout-settings:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try { auth = await requireDeveloper(request) } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, updatePayoutSettingsSchema)

    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (body.payoutSchedule !== undefined) {
      updates.payoutSchedule = body.payoutSchedule
    }
    if (body.payoutMinimumCents !== undefined) {
      updates.payoutMinimumCents = body.payoutMinimumCents
    }

    const [updated] = await db
      .update(developers)
      .set(updates)
      .where(eq(developers.id, auth.id))
      .returning({
        payoutSchedule: developers.payoutSchedule,
        payoutMinimumCents: developers.payoutMinimumCents,
        updatedAt: developers.updatedAt,
      })

    if (!updated) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'settings.payout_updated',
      resourceType: 'developer',
      resourceId: auth.id,
      details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {/* fire-and-forget */})

    return successResponse({ payoutSettings: updated })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
