import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { isInternalEmail } from '@/lib/internal-accounts'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

/** Percentage change threshold for alerting */
const SIGNIFICANT_CHANGE_PCT = 10

interface EcosystemMetrics {
  npmWeeklyDownloads: number | null
  githubStars: number | null
  // Tools/developers reported EXTERNAL (excludes internal/seed/system accounts per
  // lib/internal-accounts.ts) with the raw total alongside, so the email can't be
  // misread as traction. STOPGAP until developers.isInternal ships — see
  // docs/tech-debt/ecosystem-metrics-internal-account-exclusion-2026-06-14.md.
  activeToolsExternal: number
  activeToolsTotal: number
  totalUnclaimedTools: number
  developersExternal: number
  developersTotal: number
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
async function countTools(): Promise<{ activeExternal: number; activeTotal: number; unclaimed: number }> {
  try {
    // Fetch active tools WITH owner email so internal/seed-owned tools (e.g. the
    // ~29 seed tools owned by the seed-data account) are excluded from the external
    // count. Scale is tiny (tens of active tools); the JS filter reuses the single
    // isInternalEmail source of truth shared with the future isInternal backfill.
    const activeRows = await db
      .select({ ownerEmail: developers.email })
      .from(tools)
      .leftJoin(developers, eq(developers.id, tools.developerId))
      .where(eq(tools.status, 'active'))
    const activeTotal = activeRows.length
    const activeExternal = activeRows.filter((r) => !isInternalEmail(r.ownerEmail)).length

    const [unclaimedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'unclaimed'))

    return {
      activeExternal,
      activeTotal,
      unclaimed: unclaimedRow?.count ?? 0,
    }
  } catch {
    return { activeExternal: 0, activeTotal: 0, unclaimed: 0 }
  }
}

/**
 * Count total developers in SettleGrid DB
 */
async function countDevelopers(): Promise<{ external: number; total: number }> {
  try {
    const rows = await db.select({ email: developers.email }).from(developers)
    const total = rows.length
    const external = rows.filter((r) => !isInternalEmail(r.email)).length
    return { external, total }
  } catch {
    return { external: 0, total: 0 }
  }
}

/**
 * Send summary email if significant changes detected
 */
async function sendSummaryIfSignificant(metrics: EcosystemMetrics): Promise<void> {
  // For now, always send the summary on each run (weekly cron)
  // In the future, compare against stored previous values

  const lines = [
    `<strong>MCP SDK — npm weekly downloads (ecosystem, not SettleGrid):</strong> ${metrics.npmWeeklyDownloads?.toLocaleString() ?? 'N/A'}`,
    `<strong>MCP servers repo — GitHub stars (ecosystem, not SettleGrid):</strong> ${metrics.githubStars?.toLocaleString() ?? 'N/A'}`,
    `<strong>Active Tools (external):</strong> ${metrics.activeToolsExternal.toLocaleString()} <span style="color:#999;">(${metrics.activeToolsTotal.toLocaleString()} total incl. internal/seed)</span>`,
    `<strong>Unclaimed Tools (crawled catalog):</strong> ${metrics.totalUnclaimedTools.toLocaleString()}`,
    `<strong>Total Developers (external):</strong> ${metrics.developersExternal.toLocaleString()} <span style="color:#999;">(${metrics.developersTotal.toLocaleString()} total incl. internal/seed)</span>`,
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
    const ip = getClientIp(request.headers)
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
      activeToolsExternal: toolCounts.activeExternal,
      activeToolsTotal: toolCounts.activeTotal,
      totalUnclaimedTools: toolCounts.unclaimed,
      developersExternal: developerCount.external,
      developersTotal: developerCount.total,
      timestamp: new Date().toISOString(),
    }

    // Log all metrics via structured logger
    logger.info('cron.ecosystem_metrics.collected', {
      npmWeeklyDownloads: metrics.npmWeeklyDownloads,
      githubStars: metrics.githubStars,
      activeToolsExternal: metrics.activeToolsExternal,
      activeToolsTotal: metrics.activeToolsTotal,
      totalUnclaimedTools: metrics.totalUnclaimedTools,
      developersExternal: metrics.developersExternal,
      developersTotal: metrics.developersTotal,
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
