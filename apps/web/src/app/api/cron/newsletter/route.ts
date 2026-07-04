import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { verifyCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendEmail, ecosystemNewsletterEmail } from '@/lib/email'
import { isSuppressed } from '@/lib/email-suppression'
import { getRedis, tryRedis } from '@/lib/redis'

export const maxDuration = 120

/** Maximum recipients per cron run to stay within Resend limits */
const MAX_RECIPIENTS_PER_RUN = 500

/** Batch size for sending emails */
const BATCH_SIZE = 10

/** Delay between batches in ms (avoid Resend rate limits) */
const BATCH_DELAY_MS = 500

/**
 * Fetch cached ecosystem metrics from Redis (written by ecosystem-metrics cron).
 */
async function getEcosystemMetrics(): Promise<{
  npmDownloads: number | null
  githubStars: number | null
}> {
  const result = await tryRedis(async () => {
    const redis = getRedis()
    const data = await redis.get('ecosystem:latest_metrics')
    return data
  })

  if (result && typeof result === 'object') {
    const metrics = result as Record<string, unknown>
    return {
      npmDownloads: typeof metrics.npmWeeklyDownloads === 'number' ? metrics.npmWeeklyDownloads : null,
      githubStars: typeof metrics.githubStars === 'number' ? metrics.githubStars : null,
    }
  }

  return { npmDownloads: null, githubStars: null }
}

/**
 * Vercel Cron handler: sends ecosystem newsletter.
 *
 * Schedule: every Monday at noon UTC (0 12 * * 1)
 * Weekly subscribers get it every Monday.
 * Monthly subscribers get it only on the first Monday of the month (day <= 7).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-newsletter:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.newsletter.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.newsletter.starting')

    // Gather marketplace stats
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [activeToolsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(1)

    const totalActiveTools = activeToolsResult?.count ?? 0

    const [newToolsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(sql`${tools.status} = 'active' AND ${tools.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
      .limit(1)

    const newToolsCount = newToolsResult?.count ?? 0

    // Get highlight tools (recently added, active)
    const highlightTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
      })
      .from(tools)
      .where(sql`${tools.status} = 'active' AND ${tools.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
      .orderBy(sql`${tools.totalInvocations} DESC`)
      .limit(5)

    // Get trending categories
    const trendingCats = await db
      .select({
        category: tools.category,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(sql`${tools.status} = 'active' AND ${tools.category} IS NOT NULL AND ${tools.createdAt} >= ${thirtyDaysAgo.toISOString()}::timestamptz`)
      .groupBy(tools.category)
      .orderBy(sql`count(*) DESC`)
      .limit(5)

    const trendingCategories = trendingCats
      .map((c) => c.category)
      .filter((c): c is string => c !== null)

    // Get ecosystem metrics from Redis
    const ecosystemMetrics = await getEcosystemMetrics()

    // Determine which frequency group to send to this run
    // Weekly: every Monday. Monthly: only first Monday of the month (day <= 7).
    const today = new Date()
    const isFirstWeekOfMonth = today.getUTCDate() <= 7
    const frequencyFilter = isFirstWeekOfMonth
      ? sql`${consumers.newsletterFrequency} IN ('weekly', 'monthly')` // Both groups
      : eq(consumers.newsletterFrequency, 'weekly') // Weekly only

    // Get subscribed consumers matching frequency
    const subscribers = await db
      .select({
        email: consumers.email,
      })
      .from(consumers)
      .where(sql`${consumers.newsletterSubscribed} = true AND ${frequencyFilter}`)
      .limit(MAX_RECIPIENTS_PER_RUN)

    if (subscribers.length === 0) {
      logger.info('cron.newsletter.no_subscribers')
      return successResponse({ sent: 0, message: 'No subscribers' })
    }

    // Send emails in batches
    let sentCount = 0
    let failCount = 0
    let skippedCount = 0

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (subscriber) => {
          // Belt-and-suspenders: the SQL audience filter already excludes
          // newsletterSubscribed=false, but also consult the canonical gate so
          // a bounce/complaint ('all') or a table opt-out is honored. Inside
          // this per-item boundary the gate fails CLOSED (a missing table in
          // the deploy window pauses this send, doesn't crash the run).
          if (await isSuppressed(subscriber.email, 'newsletter')) {
            return 'skipped' as const
          }

          const emailData = ecosystemNewsletterEmail({
            npmDownloads: ecosystemMetrics.npmDownloads,
            githubStars: ecosystemMetrics.githubStars,
            newToolsCount,
            totalActiveTools,
            trendingCategories,
            highlightTools: highlightTools.map((t) => ({
              name: t.name,
              slug: t.slug,
              description: t.description ?? '',
            })),
            recipientEmail: subscriber.email,
          })

          return sendEmail({
            to: subscriber.email,
            subject: emailData.subject,
            html: emailData.html,
            headers: {
              'List-Unsubscribe': `<https://settlegrid.ai/api/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'skipped') skippedCount++
          else if (result.value) sentCount++
          else failCount++
        } else {
          failCount++
        }
      }

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    logger.info('cron.newsletter.completed', {
      sentCount,
      failCount,
      skippedCount,
      total: subscribers.length,
    })

    return successResponse({
      sent: sentCount,
      failed: failCount,
      skipped: skippedCount,
      total: subscribers.length,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
