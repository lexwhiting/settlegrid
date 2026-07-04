import { NextRequest } from 'next/server'
import { sql, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers, invocations, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  sendEmail,
  consumerWeeklyDigest,
  type DigestToolUsage,
  type DigestNewTool,
} from '@/lib/email'
import { isSuppressed, listUnsubscribeHeaders } from '@/lib/email-suppression'

export const maxDuration = 120

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum consumers to process per run */
const MAX_CONSUMERS_PER_RUN = 200

/** Maximum emails per cron run to avoid Resend rate limits */
const MAX_EMAILS_PER_RUN = 100

/** Lookback window: 7 days */
const LOOKBACK_DAYS = 7

// ── Route Handler ──────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: sends weekly digest emails to consumers.
 *
 * Schedule: Monday 10:00 AM UTC
 *
 * For each consumer with invocations in the past week:
 * - Queries their tool usage (top tools, total spend, total invocations)
 * - Queries new tools in categories they've used
 * - Sends a digest email with usage summary + new tool recommendations
 *
 * Only sends to consumers with supabaseUserId (real users, not seed data).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-consumer-digest:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.consumer_digest.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.consumer_digest.starting')

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    // Find consumers with invocations in the past week who have real accounts
    const activeConsumers = await db
      .select({
        consumerId: consumers.id,
        email: consumers.email,
      })
      .from(consumers)
      .where(
        sql`${consumers.id} IN (
          SELECT DISTINCT consumer_id FROM invocations
          WHERE created_at >= ${oneWeekAgo}
          AND is_test = false
        ) AND ${isNotNull(consumers.supabaseUserId)}`
      )
      .limit(MAX_CONSUMERS_PER_RUN)

    if (activeConsumers.length === 0) {
      logger.info('cron.consumer_digest.no_active_consumers')
      return successResponse({ processed: 0, sent: 0, skipped: 0 })
    }

    let sent = 0
    let skipped = 0

    for (const consumer of activeConsumers) {
      if (sent >= MAX_EMAILS_PER_RUN) {
        logger.info('cron.consumer_digest.email_cap_reached', { sent })
        break
      }

      try {
        // Suppression gate — the canonical (email,'consumer-digest') / (email,'all')
        // key. Replaces the orphaned unsub:consumer-digest: Redis key that no
        // writer ever set (the G6-2 no-op). Fails CLOSED inside this per-item
        // try/catch, so a missing table in the deploy window pauses this
        // consumer's send rather than crashing the run.
        if (await isSuppressed(consumer.email, 'consumer-digest')) {
          skipped++
          continue
        }

        // Get invocation stats for this consumer (past 7 days)
        const usageRows = await db
          .select({
            toolId: invocations.toolId,
            toolName: tools.name,
            toolSlug: tools.slug,
            totalInvocations: sql<number>`count(*)::int`,
            totalSpendCents: sql<number>`COALESCE(SUM(${invocations.costCents}), 0)::int`,
          })
          .from(invocations)
          .innerJoin(tools, sql`${invocations.toolId} = ${tools.id}`)
          .where(
            sql`${invocations.consumerId} = ${consumer.consumerId}
              AND ${invocations.createdAt} >= ${oneWeekAgo}
              AND ${invocations.isTest} = false`
          )
          .groupBy(invocations.toolId, tools.name, tools.slug)
          .orderBy(sql`count(*) DESC`)
          .limit(10)

        if (usageRows.length === 0) {
          skipped++
          continue
        }

        const totalInvocations = usageRows.reduce((sum, r) => sum + r.totalInvocations, 0)
        const totalSpendCents = usageRows.reduce((sum, r) => sum + r.totalSpendCents, 0)

        const topTools: DigestToolUsage[] = usageRows.map((r) => ({
          name: r.toolName,
          slug: r.toolSlug,
          invocations: r.totalInvocations,
          spendCents: r.totalSpendCents,
        }))

        // Find categories the consumer has used
        const usedCategories = await db
          .select({ category: tools.category })
          .from(invocations)
          .innerJoin(tools, sql`${invocations.toolId} = ${tools.id}`)
          .where(
            sql`${invocations.consumerId} = ${consumer.consumerId}
              AND ${invocations.createdAt} >= ${oneWeekAgo}
              AND ${tools.category} IS NOT NULL`
          )
          .groupBy(tools.category)
          .limit(10)

        const categories = usedCategories
          .map((r) => r.category)
          .filter((c): c is string => c !== null)

        // Find new tools in those categories (created this week)
        let newTools: DigestNewTool[] = []
        if (categories.length > 0) {
          const newToolRows = await db
            .select({
              name: tools.name,
              slug: tools.slug,
              category: tools.category,
              description: tools.description,
            })
            .from(tools)
            .where(
              sql`${tools.createdAt} >= ${oneWeekAgo.toISOString()}::timestamptz
                AND ${tools.status} IN ('active', 'unclaimed')
                AND ${tools.category} IN (${sql.join(categories.map((c) => sql`${c}`), sql`, `)})`
            )
            .orderBy(sql`${tools.totalInvocations} DESC`)
            .limit(5)

          newTools = newToolRows.map((r) => ({
            name: r.name,
            slug: r.slug,
            category: r.category,
            description: r.description,
          }))
        }

        // Build and send digest
        const template = consumerWeeklyDigest(
          consumer.email,
          totalInvocations,
          totalSpendCents,
          topTools,
          newTools
        )

        const emailSent = await sendEmail({
          to: consumer.email,
          subject: template.subject,
          html: template.html,
          headers: listUnsubscribeHeaders(consumer.email, 'consumer-digest'),
        })

        if (emailSent) {
          sent++
          logger.info('cron.consumer_digest.sent', {
            consumerId: consumer.consumerId,
            invocations: totalInvocations,
          })
        } else {
          skipped++
          logger.warn('cron.consumer_digest.email_failed', {
            consumerId: consumer.consumerId,
          })
        }
      } catch (err) {
        logger.error('cron.consumer_digest.consumer_failed', {
          consumerId: consumer.consumerId,
        }, err)
        skipped++
      }
    }

    logger.info('cron.consumer_digest.completed', {
      processed: activeConsumers.length,
      sent,
      skipped,
    })

    return successResponse({ processed: activeConsumers.length, sent, skipped })
  } catch (error) {
    logger.error('cron.consumer_digest.failed', {}, error)
    return internalErrorResponse(error)
  }
}
