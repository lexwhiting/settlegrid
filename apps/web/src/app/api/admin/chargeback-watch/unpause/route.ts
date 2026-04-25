/**
 * P3.RAIL3 — POST /api/admin/chargeback-watch/unpause.
 *
 * Founder-only endpoint to reverse the auto-pause set by
 * `scripts/chargeback-velocity.ts` when a developer crosses the red
 * tier. Hostile (c) — auto-pause must be reversible via an admin
 * action, not permanent.
 *
 * Effects:
 *   - Flips `developers.onboarding_paused` back to false.
 *   - Marks the latest red-tier `chargeback_alerts` row for that
 *     developer as `resolvedAt = now`, `resolvedReason = 'admin
 *     unpaused'` so the audit trail records who unblocked them.
 *   - Audit-logs the action with the founder's identity.
 *
 * Idempotent: a re-submit on an already-unpaused developer returns
 * 200 with `applied: false` rather than 409 — admin tools should
 * tolerate stale UI state.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, chargebackAlerts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  parseBody,
} from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

const unpauseSchema = z.object({
  developerId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `chargeback-unpause:${ip.split(',')[0]?.trim() ?? 'unknown'}`)
    if (!rl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Authentication required',
        401,
        'UNAUTHORIZED',
      )
    }

    if (!ADMIN_EMAILS.includes(auth.email)) {
      // Generic 403 — do not leak the gate's existence to non-admins.
      return errorResponse('Forbidden.', 403, 'FORBIDDEN')
    }

    const body = await parseBody(request, unpauseSchema)

    const [target] = await db
      .select({
        id: developers.id,
        email: developers.email,
        onboardingPaused: developers.onboardingPaused,
      })
      .from(developers)
      .where(eq(developers.id, body.developerId))
      .limit(1)

    if (!target) {
      return errorResponse('Developer not found.', 404, 'NOT_FOUND')
    }

    if (!target.onboardingPaused) {
      // Idempotent — already unpaused. Return 200 so the admin UI
      // can re-render without surfacing a "conflict" error on a
      // stale page.
      return successResponse({
        developerId: target.id,
        applied: false,
        reason: 'already-unpaused',
      })
    }

    await db
      .update(developers)
      .set({
        onboardingPaused: false,
        onboardingPausedAt: null,
        onboardingPausedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, target.id))

    await db
      .update(chargebackAlerts)
      .set({
        resolvedAt: new Date(),
        resolvedReason:
          body.note && body.note.length > 0
            ? `admin unpaused: ${body.note}`
            : 'admin unpaused',
      })
      .where(
        and(
          eq(chargebackAlerts.developerId, target.id),
          eq(chargebackAlerts.tier, 'red'),
          // Mark every unresolved red-tier row as resolved by this
          // admin action. If multiple red rows exist (e.g. the cron
          // emitted alerts on consecutive days before the founder
          // intervened), they all clear together — the
          // chargeback-watch admin page only surfaces unresolved
          // rows, so there's no benefit to leaving older red rows
          // dangling. Already-resolved rows are filtered out by the
          // `resolvedAt IS NULL` predicate.
          sql`${chargebackAlerts.resolvedAt} IS NULL`,
        ),
      )

    await writeAuditLog({
      developerId: auth.id,
      action: 'chargeback.unpause',
      resourceType: 'developer',
      resourceId: target.id,
      details: {
        targetDeveloperEmail: target.email,
        adminEmail: auth.email,
        note: body.note ?? null,
      },
    }).catch((err) => {
      logger.warn('audit_log.write_failed', { error: err instanceof Error ? err.message : String(err) })
    })

    return successResponse({
      developerId: target.id,
      applied: true,
      reason: 'unpaused',
    })
  } catch (err) {
    return internalErrorResponse(err)
  }
}
