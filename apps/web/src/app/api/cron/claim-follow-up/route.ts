import { NextRequest } from 'next/server'
import { eq, and, isNotNull, sql, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import {
  sendEmail,
  FROM_OUTREACH,
  claimFollowUpE2,
  claimFollowUpE3,
  claimFollowUpE4,
} from '@/lib/email'
import { resolveCreatorEmail } from '@/lib/ecosystem-email-resolver'

export const maxDuration = 120

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum tools to process per cron run */
const MAX_TOOLS_PER_RUN = 50

/** Shared daily email cap with claim-outreach (same Redis key) */
const MAX_EMAILS_PER_DAY = 50

/**
 * Build-mode kill switch. Defaults to OFF (follow-ups skipped) so the cron
 * remains paused unless an operator explicitly opts back in by setting
 * CLAIM_EMAILS_ENABLED=true. When OFF, the cron handler exits immediately
 * after auth so no DB queries or send work happens, and the follow-up
 * counter is not incremented (tools resume their follow-up sequence at the
 * same point when the switch flips back on).
 *
 * Shared with claim-outreach so a single env var pauses both initial outreach
 * and the entire follow-up sequence.
 */
function claimEmailsEnabled(): boolean {
  return process.env.CLAIM_EMAILS_ENABLED === 'true'
}

/** Redis daily cap TTL: 24 hours in seconds */
const REDIS_DAILY_CAP_TTL_SECONDS = 24 * 60 * 60

/** Follow-up schedule: days after initial email send for each follow-up */
const FOLLOW_UP_SCHEDULE: ReadonlyArray<{ count: number; minDays: number }> = [
  { count: 0, minDays: 3 },   // E2: 3 days after initial email
  { count: 1, minDays: 7 },   // E3: 7 days after E2
  { count: 2, minDays: 14 },  // E4: 14 days after E3
]

/**
 * Determine the follow-up anchor date for the state machine.
 * count=0: use claimEmailSentAt (days since initial email)
 * count>0: use lastFollowUpAt (days since last follow-up)
 */
function getAnchorDate(
  claimEmailSentAt: Date,
  lastFollowUpAt: Date | null,
  count: number
): Date {
  if (count === 0) return claimEmailSentAt
  return lastFollowUpAt ?? claimEmailSentAt
}

// ── Route Handler ──────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: sends follow-up claim outreach emails (E2/E3/E4).
 *
 * Schedule: daily at 2 PM UTC
 *
 * State machine:
 * - count=0, 3+ days since initial email  -> send E2
 * - count=1, 7+ days since E2             -> send E3
 * - count=2, 14+ days since E3            -> send E4
 *
 * Shares the 50/day Redis cap with claim-outreach.
 * Prioritizes follow-ups (higher conversion) over initial outreach.
 * Orders by count ASC (earlier follow-ups first), then oldest first.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-claim-follow-up:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.claim_follow_up.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Build-mode kill switch: skip the entire run if claim emails are disabled.
    // Follow-up counter is not incremented, so the sequence resumes from the
    // same point when the switch is flipped back on.
    if (!claimEmailsEnabled()) {
      logger.info('cron.claim_follow_up.skipped_kill_switch', {
        reason: 'CLAIM_EMAILS_ENABLED is not set to true',
      })
      return successResponse({
        skipped: true,
        reason: 'kill_switch',
        flag: 'CLAIM_EMAILS_ENABLED',
      })
    }

    logger.info('cron.claim_follow_up.starting')

    const redis = getRedis()

    // Check shared daily cap
    const todayKey = `claim:daily-count:${new Date().toISOString().slice(0, 10)}`
    const dailyCountRaw = await redis.get<string>(todayKey)
    const dailySent = dailyCountRaw ? parseInt(dailyCountRaw, 10) || 0 : 0

    if (dailySent >= MAX_EMAILS_PER_DAY) {
      logger.info('cron.claim_follow_up.daily_cap_reached', { dailySent, cap: MAX_EMAILS_PER_DAY })
      return successResponse({ processed: 0, sent: 0, skipped: 0, dailyCapReached: true })
    }

    const remainingBudget = MAX_EMAILS_PER_DAY - dailySent

    // Query tools eligible for follow-up:
    // - status = 'unclaimed'
    // - claimEmailSentAt IS NOT NULL and != epoch (epoch = no email found)
    // - claimFollowUpCount < 3
    // - claimToken IS NOT NULL
    const epochDate = new Date(0)
    const eligibleTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        sourceRepoUrl: tools.sourceRepoUrl,
        sourceEcosystem: tools.sourceEcosystem,
        claimToken: tools.claimToken,
        claimEmailSentAt: tools.claimEmailSentAt,
        claimFollowUpCount: tools.claimFollowUpCount,
        lastFollowUpAt: tools.lastFollowUpAt,
      })
      .from(tools)
      .where(
        and(
          eq(tools.status, 'unclaimed'),
          isNotNull(tools.claimEmailSentAt),
          // Exclude epoch-sentinel records (no email found)
          sql`${tools.claimEmailSentAt} > ${epochDate}`,
          lt(tools.claimFollowUpCount, 3),
          isNotNull(tools.claimToken)
        )
      )
      .orderBy(
        // Follow-ups first (count ASC = earlier follow-ups first)
        tools.claimFollowUpCount,
        // Then oldest first
        tools.claimEmailSentAt
      )
      .limit(MAX_TOOLS_PER_RUN)

    if (eligibleTools.length === 0) {
      logger.info('cron.claim_follow_up.no_tools', { msg: 'No eligible tools for follow-up' })
      return successResponse({ processed: 0, sent: 0, skipped: 0 })
    }

    let sent = 0
    let skipped = 0
    const now = new Date()

    // Get marketplace tool count for E3 social proof
    let toolCount = 0
    try {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(sql`${tools.status} IN ('active', 'unclaimed')`)
      toolCount = countResult?.count ?? 0
    } catch {
      toolCount = 0
    }

    for (const tool of eligibleTools) {
      if (sent >= remainingBudget) {
        logger.info('cron.claim_follow_up.daily_cap_mid_run', { sent, remainingBudget })
        break
      }

      try {
        if (!tool.claimEmailSentAt || !tool.claimToken) {
          skipped++
          continue
        }

        // Find the matching follow-up schedule entry
        const schedule = FOLLOW_UP_SCHEDULE.find((s) => s.count === tool.claimFollowUpCount)
        if (!schedule) {
          skipped++
          continue
        }

        // Check timing: enough days elapsed since anchor
        const anchor = getAnchorDate(tool.claimEmailSentAt, tool.lastFollowUpAt, tool.claimFollowUpCount)
        const daysSinceAnchor = (now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceAnchor < schedule.minDays) {
          skipped++
          continue
        }

        // Resolve creator email
        if (!tool.sourceRepoUrl) {
          skipped++
          continue
        }

        const creator = await resolveCreatorEmail(tool.sourceRepoUrl, tool.sourceEcosystem)
        if (!creator) {
          skipped++
          continue
        }

        // Check unsubscribe suppression
        const unsubKey = `unsub:outreach:${creator.email.toLowerCase()}`
        const isUnsubscribed = await redis.get<string>(unsubKey)
        if (isUnsubscribed) {
          logger.info('cron.claim_follow_up.unsubscribed', { slug: tool.slug })
          skipped++
          continue
        }

        // Check bounce suppression (set by webhook or previous send failure)
        const bounceKey = `bounce:outreach:${creator.email.toLowerCase()}`
        const isBounced = await redis.get<string>(bounceKey)
        if (isBounced) {
          logger.info('cron.claim_follow_up.bounced_email', { slug: tool.slug })
          skipped++
          continue
        }

        const firstName = creator.name
          ? creator.name.split(/\s+/)[0] || creator.username
          : creator.username

        // Select template based on follow-up count
        let emailTemplate
        switch (tool.claimFollowUpCount) {
          case 0:
            emailTemplate = claimFollowUpE2(
              firstName, tool.name, tool.slug, tool.claimToken, creator.email
            )
            break
          case 1:
            emailTemplate = claimFollowUpE3(
              firstName, tool.name, tool.claimToken, toolCount, creator.email, tool.slug
            )
            break
          case 2:
            emailTemplate = claimFollowUpE4(
              firstName, tool.name, tool.claimToken, creator.email, tool.slug
            )
            break
          default:
            skipped++
            continue
        }

        const emailSent = await sendEmail({
          to: creator.email,
          from: FROM_OUTREACH,
          replyTo: 'luther@settlegrid.ai',
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        })

        if (!emailSent) {
          // Track email delivery failure — suppress future follow-ups to this address
          const failBounceKey = `bounce:outreach:${creator.email.toLowerCase()}`
          await redis.set(failBounceKey, '1', { ex: 30 * 24 * 60 * 60 }) // 30-day suppression
          logger.warn('cron.claim_follow_up.email_failed', {
            slug: tool.slug,
            followUp: tool.claimFollowUpCount + 1,
          })
          continue
        }

        // Update tool record
        await db
          .update(tools)
          .set({
            claimFollowUpCount: tool.claimFollowUpCount + 1,
            lastFollowUpAt: now,
            updatedAt: now,
          })
          .where(eq(tools.id, tool.id))

        // Increment shared daily counter
        const newCount = await redis.incr(todayKey)
        if (newCount === 1 || newCount === dailySent + 1) {
          await redis.expire(todayKey, REDIS_DAILY_CAP_TTL_SECONDS)
        }

        sent++

        logger.info('cron.claim_follow_up.sent', {
          slug: tool.slug,
          followUp: tool.claimFollowUpCount + 1,
          email: creator.email.split('@')[0]?.slice(0, 3) + '***',
        })
      } catch (toolErr) {
        logger.error('cron.claim_follow_up.tool_failed', { slug: tool.slug }, toolErr)
        skipped++
      }
    }

    logger.info('cron.claim_follow_up.completed', {
      processed: eligibleTools.length,
      sent,
      skipped,
    })

    return successResponse({
      processed: eligibleTools.length,
      sent,
      skipped,
    })
  } catch (error) {
    logger.error('cron.claim_follow_up.failed', {}, error)
    return internalErrorResponse(error)
  }
}
