import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getRedis } from '@/lib/redis'
import { sendEmail, baseEmailTemplate, escapeHtml, sanitizeSubject } from '@/lib/email'

export const maxDuration = 60

// ─── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'lexwhiting365@gmail.com'
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-GitHubMonitor/1.0 (https://settlegrid.ai)'

/** Redis key TTL for dedup: 30 days */
const DEDUP_TTL_SECONDS = 30 * 24 * 60 * 60

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GitHubRepo {
  full_name: string
  name: string
  description: string | null
  html_url: string
  stargazers_count: number
  owner: {
    login: string
  }
  created_at: string
  topics: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns yesterday's date as YYYY-MM-DD in UTC.
 */
function getYesterdayDateString(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Searches GitHub for repositories matching a query.
 * Uses GITHUB_TOKEN for higher rate limits if available.
 */
async function searchGitHubRepos(query: string): Promise<GitHubRepo[]> {
  try {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', query)
    url.searchParams.set('sort', 'stars')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', '100')

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github.v3+json',
    }

    const githubToken = process.env.GITHUB_TOKEN
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      // Handle rate limiting gracefully
      if (res.status === 403 || res.status === 429) {
        logger.warn('cron.github.rate_limited', {
          status: res.status,
          hasToken: Boolean(githubToken),
        })
        return []
      }
      logger.warn('cron.github.fetch_failed', { status: res.status, query })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    const items = (data as { items?: unknown[] }).items
    if (!Array.isArray(items)) return []

    const repos: GitHubRepo[] = []
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue
      const r = item as Record<string, unknown>

      const owner =
        typeof r.owner === 'object' && r.owner !== null
          ? (r.owner as Record<string, unknown>)
          : null

      repos.push({
        full_name: typeof r.full_name === 'string' ? r.full_name : '',
        name: typeof r.name === 'string' ? r.name : '',
        description: typeof r.description === 'string' ? r.description : null,
        html_url: typeof r.html_url === 'string' ? r.html_url : '',
        stargazers_count: typeof r.stargazers_count === 'number' ? r.stargazers_count : 0,
        owner: {
          login: owner && typeof owner.login === 'string' ? owner.login : '',
        },
        created_at: typeof r.created_at === 'string' ? r.created_at : '',
        topics: Array.isArray(r.topics)
          ? (r.topics as unknown[]).filter((t) => typeof t === 'string') as string[]
          : [],
      })
    }

    return repos
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('cron.github.fetch_error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      query,
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * Sends an alert email listing new MCP server repos found today.
 */
async function sendGitHubAlertEmail(repos: GitHubRepo[]): Promise<void> {
  const count = repos.length
  const subject = sanitizeSubject(
    `${count} new MCP server repo${count === 1 ? '' : 's'} found today`
  )

  const repoListHtml = repos
    .map(
      (r) =>
        `<li style="margin-bottom:12px">
  <a href="${escapeHtml(r.html_url)}" style="color:#E5A336;font-weight:600;text-decoration:underline">${escapeHtml(r.full_name)}</a>
  <span style="color:#9ca3af;font-size:12px;margin-left:8px">${r.stargazers_count} stars</span>
  ${r.description ? `<br><span style="color:#6b7280;font-size:13px">${escapeHtml(r.description.slice(0, 200))}</span>` : ''}
</li>`
    )
    .join('\n')

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">${count} New MCP Server Repo${count === 1 ? '' : 's'} Found</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 16px">The following new repositories with MCP server topics were created in the last 24 hours:</p>
<ul style="padding-left:20px;margin:0 0 16px">${repoListHtml}</ul>
`,
    { preheader: `${count} new MCP server repos discovered` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: finds new MCP server repos on GitHub daily.
 * Schedule: daily at 8 AM UTC
 *
 * Searches for repos with topics "mcp-server" and "mcp" created yesterday.
 * Deduplicates via Redis and sends a summary alert email.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-monitor-github:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.github.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const yesterday = getYesterdayDateString()
    const redis = getRedis()

    // Run two searches: topic:mcp-server and topic:mcp
    const [mcpServerRepos, mcpRepos] = await Promise.all([
      searchGitHubRepos(`topic:mcp-server created:>${yesterday}`),
      searchGitHubRepos(`topic:mcp created:>${yesterday}`),
    ])

    // Merge and deduplicate by full_name
    const seenNames = new Set<string>()
    const allRepos: GitHubRepo[] = []

    for (const repo of [...mcpServerRepos, ...mcpRepos]) {
      if (!repo.full_name || seenNames.has(repo.full_name)) continue
      seenNames.add(repo.full_name)
      allRepos.push(repo)
    }

    // Filter out already-alerted repos via Redis
    const newRepos: GitHubRepo[] = []
    for (const repo of allRepos) {
      const dedupKey = `github:alerted:${repo.full_name}`
      const alreadyAlerted = await redis.get<string>(dedupKey)
      if (alreadyAlerted) continue

      newRepos.push(repo)

      // Log each new repo with structured data
      logger.info('github.new_mcp_repo', {
        name: repo.name,
        owner: repo.owner.login,
        stars: repo.stargazers_count,
        description: repo.description?.slice(0, 200) ?? null,
        url: repo.html_url,
        topics: repo.topics,
      })

      // Mark as alerted with 30-day TTL
      await redis.set(dedupKey, '1', { ex: DEDUP_TTL_SECONDS })
    }

    // Send alert email if there are new repos
    if (newRepos.length > 0) {
      try {
        await sendGitHubAlertEmail(newRepos)
      } catch (emailErr) {
        logger.error('cron.github.email_failed', { count: newRepos.length }, emailErr)
      }
    }

    logger.info('cron.github.completed', {
      searchDate: yesterday,
      totalFound: allRepos.length,
      newRepos: newRepos.length,
      alreadyAlerted: allRepos.length - newRepos.length,
    })

    return successResponse({
      searchDate: yesterday,
      totalFound: allRepos.length,
      newRepos: newRepos.length,
      alreadyAlerted: allRepos.length - newRepos.length,
    })
  } catch (error) {
    logger.error('cron.github.failed', {}, error)
    return internalErrorResponse(error)
  }
}
