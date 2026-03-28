import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/** Percentage change threshold for alerting */
const SIGNIFICANT_CHANGE_PCT = 10

interface EcosystemMetrics {
  npmWeeklyDownloads: number | null
  githubStars: number | null
  totalActiveTools: number
  totalUnclaimedTools: number
  totalDevelopers: number
  timestamp: string
}

/**
 * Fetch npm weekly downloads for @modelcontextprotocol/sdk
 */
async function fetchNpmDownloads(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/sdk',
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { downloads?: number }
    return typeof data.downloads === 'number' ? data.downloads : null
  } catch (err) {
    logger.warn('ecosystem.npm_fetch_failed', { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * Fetch GitHub stars for modelcontextprotocol/servers
 */
async function fetchGithubStars(): Promise<number | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SettleGrid-EcosystemCron/1.0',
    }

    // Use GitHub token if available for higher rate limits
    const ghToken = process.env.GITHUB_TOKEN
    if (ghToken) {
      headers.Authorization = `Bearer ${ghToken}`
    }

    const res = await fetch(
      'https://api.github.com/repos/modelcontextprotocol/servers',
      { headers, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { stargazers_count?: number }
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch (err) {
    logger.warn('ecosystem.github_fetch_failed', { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * Count tools in SettleGrid DB
 */
async function countTools(): Promise<{ active: number; unclaimed: number }> {
  try {
    const [activeRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'active'))

    const [unclaimedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'unclaimed'))

    return {
      active: activeRow?.count ?? 0,
      unclaimed: unclaimedRow?.count ?? 0,
    }
  } catch {
    return { active: 0, unclaimed: 0 }
  }
}

/**
 * Count total developers in SettleGrid DB
 */
async function countDevelopers(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(developers)
    return row?.count ?? 0
  } catch {
    return 0
  }
}

/**
 * Send summary email if significant changes detected
 */
async function sendSummaryIfSignificant(metrics: EcosystemMetrics): Promise<void> {
  // For now, always send the summary on each run (weekly cron)
  // In the future, compare against stored previous values

  const lines = [
    `<strong>npm Weekly Downloads:</strong> ${metrics.npmWeeklyDownloads?.toLocaleString() ?? 'N/A'}`,
    `<strong>GitHub Stars:</strong> ${metrics.githubStars?.toLocaleString() ?? 'N/A'}`,
    `<strong>Active Tools:</strong> ${metrics.totalActiveTools.toLocaleString()}`,
    `<strong>Unclaimed Tools:</strong> ${metrics.totalUnclaimedTools.toLocaleString()}`,
    `<strong>Total Developers:</strong> ${metrics.totalDevelopers.toLocaleString()}`,
  ]

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1A1F3A;">Weekly Ecosystem Metrics</h2>
      <p>MCP ecosystem and SettleGrid growth summary for the week ending ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}:</p>
      <ul style="line-height: 2; padding-left: 20px;">
        ${lines.map((l) => `<li>${l}</li>`).join('\n')}
      </ul>
      <p style="margin-top: 16px; color: #999; font-size: 12px;">
        Threshold for significant change alerts: ${SIGNIFICANT_CHANGE_PCT}% growth. Generated at ${metrics.timestamp}.
      </p>
    </div>
  `

  for (const adminEmail of ADMIN_EMAILS) {
    await sendEmail({
      to: adminEmail,
      subject: '[SettleGrid] Weekly Ecosystem Metrics',
      html,
    })
  }
}

/**
 * GET /api/cron/ecosystem-metrics
 *
 * Weekly cron that tracks MCP ecosystem growth metrics.
 * Auth: CRON_SECRET verification.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-ecosystem-metrics:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.ecosystem_metrics.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    logger.info('cron.ecosystem_metrics.start')

    // Fetch all metrics in parallel
    const [npmDownloads, githubStars, toolCounts, developerCount] = await Promise.all([
      fetchNpmDownloads(),
      fetchGithubStars(),
      countTools(),
      countDevelopers(),
    ])

    const metrics: EcosystemMetrics = {
      npmWeeklyDownloads: npmDownloads,
      githubStars: githubStars,
      totalActiveTools: toolCounts.active,
      totalUnclaimedTools: toolCounts.unclaimed,
      totalDevelopers: developerCount,
      timestamp: new Date().toISOString(),
    }

    // Log all metrics via structured logger
    logger.info('cron.ecosystem_metrics.collected', {
      npmWeeklyDownloads: metrics.npmWeeklyDownloads,
      githubStars: metrics.githubStars,
      totalActiveTools: metrics.totalActiveTools,
      totalUnclaimedTools: metrics.totalUnclaimedTools,
      totalDevelopers: metrics.totalDevelopers,
    })

    // Send summary email
    await sendSummaryIfSignificant(metrics)

    logger.info('cron.ecosystem_metrics.complete')

    return successResponse({
      ok: true,
      metrics,
    })
  } catch (err) {
    logger.error('cron.ecosystem_metrics.error', {}, err)
    return internalErrorResponse(err)
  }
}
