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
const USER_AGENT = 'SettleGrid-GitHubIssueMonitor/1.0 (https://settlegrid.ai)'

/** Search queries for GitHub Issues search API */
const SEARCH_QUERIES = [
  'monetize mcp',
  '"billing api" agent',
  '"charge per call" api',
  '"ai agent payment"',
  'mcp marketplace billing',
] as const

/** Redis key TTL for dedup: 7 days */
const DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GitHubIssue {
  id: number
  title: string
  body: string | null
  html_url: string
  user: {
    login: string
  } | null
  repository_url: string
  created_at: string
  labels: Array<{ name: string }>
}

interface GitHubSearchResponse {
  total_count: number
  items: GitHubIssue[]
}

interface IssueMatch {
  issueId: number
  title: string
  url: string
  author: string
  repoUrl: string
  query: string
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

interface GitHubSearchResult {
  issues: GitHubIssue[]
  rateLimitRemaining: number | null
}

/**
 * Searches GitHub Issues for a query, filtering to items created since yesterday.
 * Returns issues plus the X-RateLimit-Remaining header for rate limit awareness.
 */
async function searchGitHubIssues(query: string): Promise<GitHubSearchResult> {
  try {
    const yesterday = getYesterdayDateString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const url = new URL('https://api.github.com/search/issues')
    url.searchParams.set('q', `${query} created:>${yesterday}`)
    url.searchParams.set('sort', 'created')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', '10')

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github.v3+json',
    }

    const githubToken = process.env.GITHUB_TOKEN
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`
    }

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers,
    })

    clearTimeout(timeout)

    // Extract rate limit remaining from GitHub response headers
    const rlRemaining = res.headers.get('x-ratelimit-remaining')
    const rateLimitRemaining = rlRemaining ? parseInt(rlRemaining, 10) : null

    if (!res.ok) {
      logger.warn('cron.github_issues.fetch_failed', { query, status: res.status, rateLimitRemaining })
      return { issues: [], rateLimitRemaining }
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return { issues: [], rateLimitRemaining }

    const parsed = data as Partial<GitHubSearchResponse>
    if (!Array.isArray(parsed.items)) return { issues: [], rateLimitRemaining }

    const issues: GitHubIssue[] = []
    for (const item of parsed.items) {
      if (typeof item !== 'object' || item === null) continue
      const issue = item as Partial<GitHubIssue>
      issues.push({
        id: typeof issue.id === 'number' ? issue.id : 0,
        title: typeof issue.title === 'string' ? issue.title : '',
        body: typeof issue.body === 'string' ? issue.body : null,
        html_url: typeof issue.html_url === 'string' ? issue.html_url : '',
        user:
          typeof issue.user === 'object' && issue.user !== null && typeof (issue.user as Record<string, unknown>).login === 'string'
            ? { login: (issue.user as { login: string }).login }
            : null,
        repository_url: typeof issue.repository_url === 'string' ? issue.repository_url : '',
        created_at: typeof issue.created_at === 'string' ? issue.created_at : '',
        labels: Array.isArray(issue.labels)
          ? issue.labels
              .filter((l): l is { name: string } => typeof l === 'object' && l !== null && typeof (l as Record<string, unknown>).name === 'string')
          : [],
      })
    }

    return { issues, rateLimitRemaining }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('cron.github_issues.fetch_error', {
      query,
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return { issues: [], rateLimitRemaining: null }
  }
}

/**
 * Extracts a readable repo name from the GitHub API repository URL.
 * Example: "https://api.github.com/repos/owner/name" -> "owner/name"
 */
function extractRepoName(repoUrl: string): string {
  const match = /repos\/(.+)$/.exec(repoUrl)
  return match ? match[1] : repoUrl
}

/**
 * Sends an alert email about a GitHub issue.
 */
async function sendIssueAlertEmail(match: IssueMatch): Promise<void> {
  const repoName = extractRepoName(match.repoUrl)

  const subject = sanitizeSubject(
    `GitHub Issue: MCP monetization discussion in ${repoName}`
  )

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">New GitHub Issue About MCP Monetization</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Repository:</strong> ${escapeHtml(repoName)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Title:</strong> ${escapeHtml(match.title)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Author:</strong> @${escapeHtml(match.author)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Search query:</strong> "${escapeHtml(match.query)}"</p>
<p style="margin:16px 0"><a href="${escapeHtml(match.url)}" style="color:#E5A336;font-weight:600;text-decoration:underline">View Issue on GitHub</a></p>
`,
    { preheader: `GitHub issue: ${match.title.slice(0, 60)}` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: monitors GitHub Issues for MCP monetization discussions.
 * Schedule: every 6 hours
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-monitor-gh-issues:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.github_issues.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const redis = getRedis()

    let totalScanned = 0
    let totalAlerted = 0
    let totalDuplicates = 0
    let rateLimitRemaining: number | null = null

    for (const query of SEARCH_QUERIES) {
      // Respect GitHub API rate limits: stop if below safety margin
      if (rateLimitRemaining !== null && rateLimitRemaining < 5) {
        logger.warn('cron.github_issues.rate_limit_low', {
          rateLimitRemaining,
          remainingQueries: SEARCH_QUERIES.length - SEARCH_QUERIES.indexOf(query),
        })
        break
      }

      const result = await searchGitHubIssues(query)
      if (result.rateLimitRemaining !== null) {
        rateLimitRemaining = result.rateLimitRemaining
      }

      for (const issue of result.issues) {
        if (!issue.id || !issue.html_url) continue
        totalScanned++

        const match: IssueMatch = {
          issueId: issue.id,
          title: issue.title,
          url: issue.html_url,
          author: issue.user?.login ?? 'unknown',
          repoUrl: issue.repository_url,
          query,
        }

        // Dedup check by issue URL (more reliable than ID across repos)
        const dedupKey = `gh-issue:alerted:${issue.id}`
        const alreadyAlerted = await redis.get<string>(dedupKey)
        if (alreadyAlerted) {
          totalDuplicates++
          continue
        }

        logger.info('github_issues.monetization_issue_found', {
          issueId: match.issueId,
          title: match.title,
          url: match.url,
          author: match.author,
          query: match.query,
        })

        try {
          await sendIssueAlertEmail(match)
          totalAlerted++
        } catch (emailErr) {
          logger.error('cron.github_issues.email_failed', { issueId: issue.id }, emailErr)
        }

        // Mark as alerted with 7-day TTL
        await redis.set(dedupKey, '1', { ex: DEDUP_TTL_SECONDS })
      }
    }

    logger.info('cron.github_issues.completed', {
      queries: SEARCH_QUERIES.length,
      totalScanned,
      totalAlerted,
      totalDuplicates,
    })

    return successResponse({
      queries: SEARCH_QUERIES.length,
      totalScanned,
      totalAlerted,
      totalDuplicates,
    })
  } catch (error) {
    logger.error('cron.github_issues.failed', {}, error)
    return internalErrorResponse(error)
  }
}
