import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { costAllocations, organizationMembers, invocations, organizations, developers, tools } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { usageWarning80Email, usageWarning90Email, usageExceededEmail } from '@/lib/email'
import { sendNotificationEmail } from '@/lib/notifications'

export const maxDuration = 60

// Monthly operation limits per tier (soft limits — tools keep working)
const TIER_OPS_LIMITS: Record<string, number> = {
  standard: 25_000,
  starter: 100_000,
  growth: 500_000,
  scale: 2_000_000,
  enterprise: Infinity,
}

/**
 * Vercel Cron handler: aggregates cost allocations by org + department
 * for the current billing period, then checks developer usage against
 * tier limits and sends warning emails at 80%, 90%, and 100% thresholds.
 * Schedule: daily at 2 AM UTC
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-aggregate-usage:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.aggregate_usage.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Period: current month start to now
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ─── Phase 1: Aggregate cost allocations ──────────────────────────
    const orgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(10000)

    let aggregatedCount = 0

    for (const org of orgs) {
      // Get members with department info
      const members = await db
        .select({
          userId: organizationMembers.userId,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, org.id))
        .limit(1000)

      if (members.length === 0) continue

      // For each member, sum their invocation costs in this period
      for (const member of members) {
        const [aggResult] = await db
          .select({
            totalCents: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)`,
            opCount: sql<number>`COUNT(*)`,
          })
          .from(invocations)
          .where(
            sql`${invocations.consumerId}::text = ${member.userId} AND ${invocations.createdAt} >= ${periodStart} AND ${invocations.createdAt} < ${periodEnd}`
          )
          .limit(1)

        if (aggResult && aggResult.opCount > 0) {
          await db
            .insert(costAllocations)
            .values({
              orgId: org.id,
              departmentTag: 'default',
              serviceId: null,
              periodStart,
              periodEnd,
              totalCents: aggResult.totalCents,
              operationCount: aggResult.opCount,
            })
            .onConflictDoNothing()

          aggregatedCount++
        }
      }
    }

    // ─── Phase 2: Developer usage tier alerts ─────────────────────────
    let alertsSent = 0

    const allDevs = await db
      .select({
        id: developers.id,
        email: developers.email,
        name: developers.name,
        tier: developers.tier,
      })
      .from(developers)
      .limit(10000)

    const redis = getRedis()

    for (const dev of allDevs) {
      try {
        const limit = TIER_OPS_LIMITS[dev.tier] ?? TIER_OPS_LIMITS.standard
        if (limit === Infinity) continue // Enterprise has no cap

        // Count this developer's tool invocations this month
        const [result] = await db
          .select({ opCount: sql<number>`COUNT(*)` })
          .from(invocations)
          .innerJoin(tools, eq(invocations.toolId, tools.id))
          .where(
            sql`${tools.developerId} = ${dev.id} AND ${invocations.createdAt} >= ${periodStart} AND ${invocations.createdAt} < ${periodEnd}`
          )
          .limit(1)

        const currentOps = result?.opCount ?? 0
        if (currentOps === 0) continue

        const usagePct = (currentOps / limit) * 100
        const devName = dev.name ?? 'Developer'

        // Determine which threshold level to alert at
        let level: '80' | '90' | '100' | null = null
        if (usagePct >= 100) {
          level = '100'
        } else if (usagePct >= 90) {
          level = '90'
        } else if (usagePct >= 80) {
          level = '80'
        }

        if (!level) continue

        // Check Redis dedup key to avoid duplicate sends
        const dedupKey = `usage-alert:${dev.id}:${monthKey}:${level}`
        const alreadySent = await redis.get<string>(dedupKey)
        if (alreadySent) continue

        // Build and send the appropriate email
        let email: { subject: string; html: string }
        if (level === '100') {
          email = usageExceededEmail(devName, currentOps, limit, dev.tier)
        } else if (level === '90') {
          email = usageWarning90Email(devName, currentOps, limit, dev.tier)
        } else {
          email = usageWarning80Email(devName, currentOps, limit, dev.tier)
        }

        await sendNotificationEmail({
          developerId: dev.id,
          eventKey: 'usage_alert',
          email: dev.email,
          subject: email.subject,
          html: email.html,
        })

        // Mark as sent — expires at end of month (max 31 days)
        await redis.set(dedupKey, '1', { ex: 31 * 24 * 60 * 60 })
        alertsSent++

        logger.info('cron.aggregate_usage.alert_sent', {
          developerId: dev.id,
          level,
          currentOps,
          limit,
          usagePct: Math.round(usagePct),
        })
      } catch (devErr) {
        // Don't let one developer failure stop the batch
        logger.error('cron.aggregate_usage.dev_alert_failed', { developerId: dev.id }, devErr)
      }
    }

    logger.info('cron.aggregate_usage.completed', {
      period: periodStart.toISOString(),
      orgsProcessed: orgs.length,
      allocationsCreated: aggregatedCount,
      alertsSent,
    })

    return successResponse({
      period: periodStart.toISOString(),
      orgsProcessed: orgs.length,
      allocationsCreated: aggregatedCount,
      alertsSent,
    })
  } catch (error) {
    logger.error('cron.aggregate_usage.failed', {}, error)
    return internalErrorResponse(error)
  }
}
