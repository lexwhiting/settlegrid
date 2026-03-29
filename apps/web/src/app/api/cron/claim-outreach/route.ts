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
import {
  sendEmail,
  claimToolOutreachEmail,
  claimAiModelEmail,
  claimPackageEmail,
  claimApiServiceEmail,
  claimAgentToolEmail,
  type EmailTemplate,
} from '@/lib/email'
import { resolveCreatorEmail } from '@/lib/ecosystem-email-resolver'

export const maxDuration = 120

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum tools to process per cron run */
const MAX_TOOLS_PER_RUN = 20

/** Maximum emails to send per calendar day (UTC). Prevents accidental spam. */
const MAX_EMAILS_PER_DAY = 50

/** Claim token length in bytes (24 bytes = 48 hex chars) */
const CLAIM_TOKEN_BYTES = 24

/** Redis dedup TTL: 90 days in seconds */
const REDIS_DEDUP_TTL_SECONDS = 90 * 24 * 60 * 60

/** Redis daily cap TTL: 24 hours in seconds */
const REDIS_DAILY_CAP_TTL_SECONDS = 24 * 60 * 60

/** Map source ecosystems to human-readable framework/ecosystem names */
const ECOSYSTEM_DISPLAY_NAMES: Record<string, string> = {
  npm: 'npm',
  pypi: 'PyPI',
  huggingface: 'HuggingFace',
  replicate: 'Replicate',
  apify: 'Apify',
  github: 'GitHub',
  'mcp-registry': 'MCP',
  smithery: 'Smithery',
  pulsemcp: 'PulseMCP',
  openrouter: 'OpenRouter',
}

// ─── Template Selection ─────────────────────────────────────────────────────

/**
 * Select the appropriate email template based on tool type and ecosystem.
 * Returns the correct outreach email for each tool category.
 */
function selectEmailTemplate(
  firstName: string,
  toolName: string,
  claimToken: string,
  toolType: string,
  sourceRepoUrl: string | null,
  sourceEcosystem: string | null
): EmailTemplate {
  const ecosystemDisplay =
    ECOSYSTEM_DISPLAY_NAMES[sourceEcosystem ?? ''] ?? sourceEcosystem ?? 'AI'

  switch (toolType) {
    case 'ai-model':
      return claimAiModelEmail(firstName, toolName, claimToken, sourceRepoUrl)

    case 'sdk-package':
      return claimPackageEmail(firstName, toolName, claimToken, ecosystemDisplay)

    case 'rest-api':
    case 'automation':
      return claimApiServiceEmail(firstName, toolName, claimToken)

    case 'agent-tool':
      return claimAgentToolEmail(
        firstName,
        toolName,
        claimToken,
        ecosystemDisplay
      )

    case 'mcp-server':
    default:
      return claimToolOutreachEmail(firstName, toolName, claimToken, sourceRepoUrl)
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: finds unclaimed tools that have not been emailed yet,
 * resolves the creator's email from the appropriate ecosystem, and sends
 * claim outreach emails.
 *
 * Schedule: daily at 10 AM UTC
 *
 * For each unclaimed tool:
 * 1. Check Redis dedup key (claim:emailed:{toolSlug})
 * 2. Resolve creator email via ecosystem-specific resolver
 * 3. Generate a unique claim token
 * 4. Send ecosystem-appropriate claim outreach email
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
    // Must have a sourceRepoUrl (otherwise we cannot find the creator)
    const unclaimedTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        sourceRepoUrl: tools.sourceRepoUrl,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
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

    // Daily cap: prevent sending more than MAX_EMAILS_PER_DAY across all runs
    const todayKey = `claim:daily-count:${new Date().toISOString().slice(0, 10)}`
    const dailyCountRaw = await redis.get<string>(todayKey)
    const dailySent = dailyCountRaw ? parseInt(dailyCountRaw, 10) || 0 : 0

    if (dailySent >= MAX_EMAILS_PER_DAY) {
      logger.info('cron.claim_outreach.daily_cap_reached', {
        dailySent,
        cap: MAX_EMAILS_PER_DAY,
      })
      return successResponse({
        processed: 0,
        emailed: 0,
        skipped: 0,
        noEmail: 0,
        dailyCapReached: true,
      })
    }

    // Remaining budget for today
    const remainingBudget = MAX_EMAILS_PER_DAY - dailySent

    for (const tool of unclaimedTools) {
      // Respect daily cap mid-loop
      if (emailed >= remainingBudget) {
        logger.info('cron.claim_outreach.daily_cap_mid_run', {
          emailed,
          remainingBudget,
        })
        break
      }
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

        // Resolve creator email from the appropriate ecosystem
        if (!tool.sourceRepoUrl) {
          skipped++
          continue
        }

        const creator = await resolveCreatorEmail(
          tool.sourceRepoUrl,
          tool.sourceEcosystem
        )
        if (!creator) {
          logger.info('cron.claim_outreach.no_email', {
            slug: tool.slug,
            sourceRepoUrl: tool.sourceRepoUrl,
            toolType: tool.toolType,
            sourceEcosystem: tool.sourceEcosystem,
          })
          noEmail++
          continue
        }

        // Generate claim token
        const claimToken = crypto.randomBytes(CLAIM_TOKEN_BYTES).toString('hex')

        // Extract first name (or fallback to username)
        const firstName = creator.name
          ? creator.name.split(/\s+/)[0] || creator.username
          : creator.username

        // Select and build the appropriate email template
        const emailTemplate = selectEmailTemplate(
          firstName,
          tool.name,
          claimToken,
          tool.toolType,
          tool.sourceRepoUrl,
          tool.sourceEcosystem
        )

        const sent = await sendEmail({
          to: creator.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        })

        if (!sent) {
          logger.warn('cron.claim_outreach.email_failed', {
            slug: tool.slug,
            email: creator.email.split('@')[0]?.slice(0, 3) + '***', // redact
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

        // Increment daily counter (incr creates the key if missing)
        const newCount = await redis.incr(todayKey)
        // Set expiry on first increment to auto-clean up
        if (newCount === 1 || newCount === dailySent + 1) {
          await redis.expire(todayKey, REDIS_DAILY_CAP_TTL_SECONDS)
        }

        emailed++

        logger.info('cron.claim_outreach.sent', {
          slug: tool.slug,
          ecosystem: creator.ecosystem,
          username: creator.username,
          toolType: tool.toolType,
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
