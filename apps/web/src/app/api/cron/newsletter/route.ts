import { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { consumers, tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail, ecosystemNewsletterEmail } from '@/lib/email'
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
 * Vercel Cron handler: sends monthly ecosystem newsletter.
 *
 * Schedule: 1st of month at noon UTC (0 12 1 * *)
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-newsletter:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.newsletter.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
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
      .where(sql`${tools.status} = 'active' AND ${tools.createdAt} >= ${thirtyDaysAgo}`)
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
      .where(sql`${tools.status} = 'active' AND ${tools.createdAt} >= ${thirtyDaysAgo}`)
      .orderBy(sql`${tools.totalInvocations} DESC`)
      .limit(5)

    // Get trending categories
    const trendingCats = await db
      .select({
        category: tools.category,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(sql`${tools.status} = 'active' AND ${tools.category} IS NOT NULL AND ${tools.createdAt} >= ${thirtyDaysAgo}`)
      .groupBy(tools.category)
      .orderBy(sql`count(*) DESC`)
      .limit(5)

    const trendingCategories = trendingCats
      .map((c) => c.category)
      .filter((c): c is string => c !== null)

    // Get ecosystem metrics from Redis
    const ecosystemMetrics = await getEcosystemMetrics()

    // Get subscribed consumers
    const subscribers = await db
      .select({
        email: consumers.email,
      })
      .from(consumers)
      .where(eq(consumers.newsletterSubscribed, true))
      .limit(MAX_RECIPIENTS_PER_RUN)

    if (subscribers.length === 0) {
      logger.info('cron.newsletter.no_subscribers')
      return successResponse({ sent: 0, message: 'No subscribers' })
    }

    // Send emails in batches
    let sentCount = 0
    let failCount = 0

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE)

      const results = await Promise.allSettled(
        batch.map(async (subscriber) => {
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
            },
          })
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          sentCount++
        } else {
          failCount++
        }
      }

      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    logger.info('cron.newsletter.completed', { sentCount, failCount, total: subscribers.length })

    return successResponse({
      sent: sentCount,
      failed: failCount,
      total: subscribers.length,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
