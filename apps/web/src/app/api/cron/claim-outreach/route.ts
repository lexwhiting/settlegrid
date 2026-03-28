import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { sendEmail, claimToolOutreachEmail } from '@/lib/email'
import { resolveDeveloperEmail } from '@/lib/developer-email-resolver'

export const maxDuration = 120

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum tools to process per cron run */
const MAX_TOOLS_PER_RUN = 20

/** Claim token length in bytes (24 bytes = 48 hex chars) */
const CLAIM_TOKEN_BYTES = 24

/** Redis dedup TTL: 90 days in seconds */
const REDIS_DEDUP_TTL_SECONDS = 90 * 24 * 60 * 60

// ─── Route Handler ──────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: finds unclaimed tools that have not been emailed yet,
 * resolves the developer's email from GitHub, and sends claim outreach emails.
 *
 * Schedule: daily at 10 AM UTC
 *
 * For each unclaimed tool:
 * 1. Check Redis dedup key (claim:emailed:{toolSlug})
 * 2. Resolve developer email from sourceRepoUrl via GitHub API
 * 3. Generate a unique claim token
 * 4. Send claim outreach email
 * 5. Update tool record with claimToken and claimEmailSentAt
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-claim-outreach:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.claim_outreach.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.claim_outreach.starting')

    // Query unclaimed tools that have not been emailed yet
    // Must have a sourceRepoUrl (otherwise we cannot find the developer)
    const unclaimedTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        sourceRepoUrl: tools.sourceRepoUrl,
      })
      .from(tools)
      .where(
        and(
          eq(tools.status, 'unclaimed'),
          isNull(tools.claimEmailSentAt),
          isNotNull(tools.sourceRepoUrl)
        )
      )
      .limit(MAX_TOOLS_PER_RUN)

    if (unclaimedTools.length === 0) {
      logger.info('cron.claim_outreach.no_tools', {
        msg: 'No unclaimed tools pending outreach',
      })
      return successResponse({
        processed: 0,
        emailed: 0,
        skipped: 0,
        noEmail: 0,
      })
    }

    const redis = getRedis()
    let emailed = 0
    let skipped = 0
    let noEmail = 0

    for (const tool of unclaimedTools) {
      try {
        // Redis dedup check
        const dedupKey = `claim:emailed:${tool.slug}`
        const alreadySent = await redis.get<string>(dedupKey)
        if (alreadySent) {
          // Mark as sent in DB so it does not appear in future queries
          await db
            .update(tools)
            .set({ claimEmailSentAt: new Date() })
            .where(eq(tools.id, tool.id))
          skipped++
          continue
        }

        // Resolve developer email from GitHub
        if (!tool.sourceRepoUrl) {
          skipped++
          continue
        }

        const developer = await resolveDeveloperEmail(tool.sourceRepoUrl)
        if (!developer) {
          logger.info('cron.claim_outreach.no_email', {
            slug: tool.slug,
            sourceRepoUrl: tool.sourceRepoUrl,
          })
          noEmail++
          continue
        }

        // Generate claim token
        const claimToken = crypto.randomBytes(CLAIM_TOKEN_BYTES).toString('hex')

        // Extract first name (or fallback to username)
        const firstName = developer.name
          ? developer.name.split(/\s+/)[0] || developer.githubUsername
          : developer.githubUsername

        // Build and send the email
        const emailTemplate = claimToolOutreachEmail(
          firstName,
          tool.name,
          claimToken,
          tool.sourceRepoUrl
        )

        const sent = await sendEmail({
          to: developer.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        })

        if (!sent) {
          logger.warn('cron.claim_outreach.email_failed', {
            slug: tool.slug,
            email: developer.email.split('@')[0]?.slice(0, 3) + '***', // redact
          })
          continue
        }

        // Update tool record
        await db
          .update(tools)
          .set({
            claimToken,
            claimEmailSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tools.id, tool.id))

        // Set Redis dedup key with 90-day TTL
        await redis.set(dedupKey, '1', { ex: REDIS_DEDUP_TTL_SECONDS })

        emailed++

        logger.info('cron.claim_outreach.sent', {
          slug: tool.slug,
          githubUser: developer.githubUsername,
        })
      } catch (toolErr) {
        logger.error(
          'cron.claim_outreach.tool_failed',
          { slug: tool.slug },
          toolErr
        )
        skipped++
      }
    }

    logger.info('cron.claim_outreach.completed', {
      processed: unclaimedTools.length,
      emailed,
      skipped,
      noEmail,
    })

    return successResponse({
      processed: unclaimedTools.length,
      emailed,
      skipped,
      noEmail,
    })
  } catch (error) {
    logger.error('cron.claim_outreach.failed', {}, error)
    return internalErrorResponse(error)
  }
}
