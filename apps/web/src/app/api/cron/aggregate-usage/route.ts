import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { costAllocations, organizationMembers, invocations, organizations } from '@/lib/db/schema'
import { sql, eq } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

/**
 * Vercel Cron handler: aggregates cost allocations by org + department
 * for the current billing period.
 * Schedule: daily at 2 AM UTC
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-aggregate-usage:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Period: current month start to now
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Get all orgs
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

      // Aggregate invocations by department (using 'default' dept for now)
      const memberIds = members.map((m) => m.userId)

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

    logger.info('cron.aggregate_usage.completed', {
      period: periodStart.toISOString(),
      orgsProcessed: orgs.length,
      allocationsCreated: aggregatedCount,
    })

    return successResponse({
      period: periodStart.toISOString(),
      orgsProcessed: orgs.length,
      allocationsCreated: aggregatedCount,
    })
  } catch (error) {
    logger.error('cron.aggregate_usage.failed', {}, error)
    return internalErrorResponse(error)
  }
}
