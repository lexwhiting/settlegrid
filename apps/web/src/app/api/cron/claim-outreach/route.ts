import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { readIndexerQualityScores, computeWeightedPriority } from '@/lib/indexer-quality'
import {
  sendEmail,
  FROM_OUTREACH,
  FROM_TRANSACTIONAL,
  claimToolOutreachEmail,
  claimAiModelEmail,
  claimPackageEmail,
  claimApiServiceEmail,
  claimAgentToolEmail,
  type EmailTemplate,
} from '@/lib/email'
import { resolveCreatorEmailWithBackfill } from '@/lib/ecosystem-email-resolver'

export const maxDuration = 120

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum tools to process per cron run */
const MAX_TOOLS_PER_RUN = 50

/** Maximum emails to send per calendar day (UTC). Prevents accidental spam. */
const MAX_EMAILS_PER_DAY = 50

/**
 * Build-mode kill switch. Defaults to OFF (emails skipped) so the cron remains
 * paused unless an operator explicitly opts back in by setting
 * CLAIM_EMAILS_ENABLED=true. When OFF, the cron handler exits immediately
 * after auth so no DB queries, email resolution, or send work happens, and
 * tools remain eligible for processing once the switch flips back on (no
 * dedup keys are written, no claimEmailSentAt timestamps are set).
 *
 * The scraping/indexing/page-generation pipelines run in separate crons and
 * are unaffected by this flag — only outbound claim email is paused.
 */
function claimEmailsEnabled(): boolean {
  return process.env.CLAIM_EMAILS_ENABLED === 'true'
}

/**
 * Threshold below which a daily run is considered degraded. If the cron
 * processes a full run and sends fewer than this many emails, an internal
 * alert fires so the founder can investigate. Set to 20% of MAX_EMAILS_PER_DAY
 * — catches silent resolver degradation early without false positives on
 * naturally light days.
 */
const LOW_EMAIL_ALERT_THRESHOLD = Math.floor(MAX_EMAILS_PER_DAY * 0.2)

/**
 * Sentinel timestamp used to mark tools where creator email could not be
 * resolved. Stored as 1970-01-01 UTC so the row is excluded from "real
 * emailed" queries while still preventing immediate re-processing.
 */
const NO_EMAIL_SENTINEL = new Date(0)

/**
 * After this many days, sentinel-marked tools become eligible for retry.
 * Lets newly-improved resolvers find emails that didn't resolve before.
 * Without retry, the dead-end pool grows monotonically and the cron
 * eventually exhausts.
 */
const SENTINEL_RETRY_AFTER_DAYS = 30

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

// Indexer interop helpers (readIndexerQualityScores, computeWeightedPriority)
// live in @/lib/indexer-quality so they can be unit-tested in isolation.

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
  sourceEcosystem: string | null,
  recipientEmail: string,
  toolSlug: string
): EmailTemplate {
  const ecosystemDisplay =
    ECOSYSTEM_DISPLAY_NAMES[sourceEcosystem ?? ''] ?? sourceEcosystem ?? 'AI'

  switch (toolType) {
    case 'ai-model':
      return claimAiModelEmail(firstName, toolName, claimToken, sourceRepoUrl, recipientEmail, toolSlug)

    case 'sdk-package':
      return claimPackageEmail(firstName, toolName, claimToken, ecosystemDisplay, recipientEmail, toolSlug)

    case 'rest-api':
    case 'automation':
      return claimApiServiceEmail(firstName, toolName, claimToken, recipientEmail, toolSlug)

    case 'agent-tool':
      return claimAgentToolEmail(firstName, toolName, claimToken, ecosystemDisplay, recipientEmail, toolSlug)

    case 'mcp-server':
    default:
      return claimToolOutreachEmail(firstName, toolName, claimToken, sourceRepoUrl, recipientEmail, toolSlug)
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

    // Build-mode kill switch: skip the entire run if claim emails are disabled.
    // No DB queries, no email resolution, no Redis writes — tools remain
    // eligible for processing when the switch is flipped back on.
    if (!claimEmailsEnabled()) {
      logger.info('cron.claim_outreach.skipped_kill_switch', {
        reason: 'CLAIM_EMAILS_ENABLED is not set to true',
      })
      return successResponse({
        skipped: true,
        reason: 'kill_switch',
        flag: 'CLAIM_EMAILS_ENABLED',
      })
    }

    logger.info('cron.claim_outreach.starting')

    // Query unclaimed tools eligible for outreach.
    // Eligible = either (a) never been processed, or (b) sentinel-marked
    // more than SENTINEL_RETRY_AFTER_DAYS ago (gives improved resolvers a
    // chance to retry old dead-ends).
    //
    // Must have a sourceRepoUrl (otherwise we cannot find the creator).
    //
    // Daily ecosystem rotation: priority shifts based on day-of-year so
    // a single ecosystem outage cannot starve the queue forever. Ecosystem
    // priority used to be hardcoded npm > smithery > github > pypi >
    // huggingface, but that left huggingface starved when npm/smithery were
    // healthy and broke completely when those upstream sources went stale.
    const sentinelCutoff = new Date(
      Date.now() - SENTINEL_RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000
    )
    const dayOfYear = Math.floor(
      (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) /
        (1000 * 60 * 60 * 24)
    )
    const ecosystemRotation = dayOfYear % 5 // 5 ranked ecosystems

    // Read per-source quality weights from the Indexer agent (best-effort).
    // The Indexer publishes scores to Redis once per week. If absent or
    // unreachable, we fall back to uniform weights = 1.0 (preserves the
    // legacy rotation behavior). The cron NEVER fails because of indexer
    // unavailability — graceful degradation is mandatory.
    const indexerScores = await readIndexerQualityScores()
    const w = {
      npm: indexerScores?.weights['npm'] ?? 1.0,
      smithery: indexerScores?.weights['smithery'] ?? 1.0,
      github: indexerScores?.weights['github'] ?? 1.0,
      pypi: indexerScores?.weights['pypi'] ?? 1.0,
      huggingface: indexerScores?.weights['huggingface'] ?? 1.0,
    }
    const npmPri = computeWeightedPriority(0, ecosystemRotation, w.npm)
    const smitheryPri = computeWeightedPriority(1, ecosystemRotation, w.smithery)
    const githubPri = computeWeightedPriority(2, ecosystemRotation, w.github)
    const pypiPri = computeWeightedPriority(3, ecosystemRotation, w.pypi)
    const hfPri = computeWeightedPriority(4, ecosystemRotation, w.huggingface)

    if (indexerScores) {
      logger.info('cron.claim_outreach.indexer_weights_loaded', {
        msg: 'Using Indexer-published quality weights for rotation',
        weights: w,
        computedAt: indexerScores.computedAt,
      })
    } else {
      // Distinguish "no Indexer published yet" / "stale" / "Redis unreachable"
      // from "scores active". Ops can correlate this with Indexer agent runs
      // to spot a silent agent failure.
      logger.info('cron.claim_outreach.indexer_weights_absent', {
        msg: 'No Indexer quality weights in Redis — using uniform 1.0 weights',
      })
    }

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
          isNotNull(tools.sourceRepoUrl),
          // Eligible: never processed OR sentinel-marked >30 days ago
          sql`(${tools.claimEmailSentAt} IS NULL OR (${tools.claimEmailSentAt} = '1970-01-01 00:00:00+00'::timestamptz AND ${tools.updatedAt} < ${sentinelCutoff.toISOString()}))`
        )
      )
      .orderBy(
        // Day-rotated ecosystem priority, weighted by Indexer-published
        // quality scores. The base rotation is `(N + 5 - rotation) % 5`
        // which keeps the 5 ranked ecosystems inside positions 0-4. Each
        // base position is then divided by its weight (default 1.0) — a
        // higher weight produces a smaller priority and sorts earlier.
        // Unrecognized sources ("other") get a fixed priority of 99 so
        // they always sort last, regardless of weights or rotation.
        sql`CASE
          WHEN source_repo_url LIKE '%npmjs.com%' THEN ${npmPri}::float
          WHEN source_repo_url LIKE '%smithery%' THEN ${smitheryPri}::float
          WHEN source_repo_url LIKE '%github.com%' THEN ${githubPri}::float
          WHEN source_repo_url LIKE '%pypi.org%' THEN ${pypiPri}::float
          WHEN source_repo_url LIKE '%huggingface%' THEN ${hfPri}::float
          ELSE 99::float
        END`,
        tools.createdAt
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

        const { creator, discoveredGitHubUrl } = await resolveCreatorEmailWithBackfill(
          tool.sourceRepoUrl,
          tool.sourceEcosystem
        )

        // Backfill: if we discovered a better GitHub URL for a non-GitHub source,
        // update the tool's source_repo_url so future runs don't need cross-referencing.
        if (discoveredGitHubUrl && !tool.sourceRepoUrl.includes('github.com')) {
          await db
            .update(tools)
            .set({
              sourceRepoUrl: discoveredGitHubUrl,
              updatedAt: new Date(),
            })
            .where(eq(tools.id, tool.id))

          logger.info('cron.claim_outreach.backfill_source_url', {
            slug: tool.slug,
            oldUrl: tool.sourceRepoUrl.slice(0, 100),
            newUrl: discoveredGitHubUrl.slice(0, 100),
          })
        }

        if (!creator) {
          logger.info('cron.claim_outreach.no_email', {
            slug: tool.slug,
            sourceRepoUrl: tool.sourceRepoUrl,
            toolType: tool.toolType,
            sourceEcosystem: tool.sourceEcosystem,
          })

          // Mark this tool with a sentinel claimEmailSentAt so it does not
          // block the queue on subsequent runs. The epoch date (1970-01-01)
          // distinguishes "no email found" from "email actually sent".
          await db
            .update(tools)
            .set({
              claimEmailSentAt: NO_EMAIL_SENTINEL,
              updatedAt: new Date(),
            })
            .where(eq(tools.id, tool.id))

          noEmail++
          continue
        }

        // Generate claim token
        const claimToken = crypto.randomBytes(CLAIM_TOKEN_BYTES).toString('hex')

        // Extract first name (or fallback to username)
        const firstName = creator.name
          ? creator.name.split(/\s+/)[0] || creator.username
          : creator.username

        // Check unsubscribe suppression list
        const unsubKey = `unsub:outreach:${creator.email.toLowerCase()}`
        const isUnsubscribed = await redis.get<string>(unsubKey)
        if (isUnsubscribed) {
          logger.info('cron.claim_outreach.unsubscribed', { slug: tool.slug })
          skipped++
          continue
        }

        // Use the discovered GitHub URL in the email template if we backfilled it
        const effectiveSourceUrl = discoveredGitHubUrl ?? tool.sourceRepoUrl

        // Select and build the appropriate email template
        const emailTemplate = selectEmailTemplate(
          firstName,
          tool.name,
          claimToken,
          tool.toolType,
          effectiveSourceUrl,
          tool.sourceEcosystem,
          creator.email,
          tool.slug
        )

        const sent = await sendEmail({
          to: creator.email,
          from: FROM_OUTREACH,
          replyTo: 'luther@settlegrid.ai',
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

    // Degradation alert: if today's TOTAL emailed (including any earlier
    // run that day) is below the alert threshold AND we processed a
    // meaningful batch, the resolver supply is degraded. Fire an internal
    // alert so the founder can investigate before it becomes a multi-day
    // silent failure (the situation surfaced 2026-04-07: counts dropped
    // from 50/day to 11/day with no alerting).
    const totalEmailedToday = dailySent + emailed
    if (
      unclaimedTools.length >= 10 &&
      totalEmailedToday < LOW_EMAIL_ALERT_THRESHOLD
    ) {
      try {
        const resolutionRate =
          unclaimedTools.length > 0
            ? Math.round((emailed / unclaimedTools.length) * 100)
            : 0
        const escapeHtml = (s: string) =>
          s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        const lines = [
          'Daily claim outreach run completed below the alert threshold.',
          '',
          `Today total emailed: ${totalEmailedToday} (threshold: ${LOW_EMAIL_ALERT_THRESHOLD})`,
          `This run: emailed=${emailed}, no_email=${noEmail}, skipped=${skipped}, processed=${unclaimedTools.length}`,
          `Resolution rate this run: ${resolutionRate}%`,
          '',
          'Most likely causes (in order of probability):',
          '  1. Crawler supply has dried up — check crawl-services and crawl-registry cron logs',
          '  2. A specific ecosystem resolver is broken — check ecosystem-email-resolver logs',
          '  3. The unclaimed pool is depleted — query tools table for unclaimed status',
          '',
          'Investigation queries:',
          "  SELECT date_trunc('day', created_at)::date, COUNT(*) FROM tools WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1 DESC;",
          "  SELECT source_ecosystem, COUNT(*) FROM tools WHERE status = 'unclaimed' AND claim_email_sent_at IS NULL GROUP BY 1;",
        ]
        const html =
          '<pre style="font-family:monospace;font-size:13px;line-height:1.5;">' +
          lines.map(escapeHtml).join('\n') +
          '</pre>'

        await sendEmail({
          to: 'luther@settlegrid.ai',
          from: FROM_TRANSACTIONAL,
          subject: `[claim-outreach] Low email count: ${totalEmailedToday}/${MAX_EMAILS_PER_DAY}`,
          html,
        })
        logger.info('cron.claim_outreach.alert_fired', {
          totalEmailedToday,
          threshold: LOW_EMAIL_ALERT_THRESHOLD,
        })
      } catch (alertErr) {
        logger.warn('cron.claim_outreach.alert_failed', {
          error: alertErr instanceof Error ? alertErr.message : String(alertErr),
        })
      }
    }

    return successResponse({
      processed: unclaimedTools.length,
      emailed,
      skipped,
      noEmail,
      totalEmailedToday,
      alertFired:
        unclaimedTools.length >= 10 &&
        totalEmailedToday < LOW_EMAIL_ALERT_THRESHOLD,
    })
  } catch (error) {
    logger.error('cron.claim_outreach.failed', {}, error)
    return internalErrorResponse(error)
  }
}
