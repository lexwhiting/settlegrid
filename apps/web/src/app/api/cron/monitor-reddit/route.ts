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
const USER_AGENT = 'SettleGrid-RedditMonitor/1.0 (https://settlegrid.ai)'

/** Subreddits to monitor */
const SUBREDDITS = [
  'mcp',
  'ClaudeAI',
  'langchain',
  'OpenAI',
  'LocalLLaMA',
  'webscraping',
  'SaaS',
  'MachineLearning',
  'artificial',
  'ChatGPT',
  'Entrepreneur',
  'startups',
] as const

/** Keywords that indicate monetization or relevant AI tool discussion */
const MONETIZATION_KEYWORDS = [
  // Direct monetization intent
  'monetize',
  'billing',
  'charge for',
  'earn money',
  'make money from',
  'sell my',
  'paid api',
  'paid tool',
  'revenue from',
  'pricing model',
  'per-call',
  'per call',
  'usage-based',
  'metering',
  // AI tool/agent commerce
  'agent payment',
  'agent billing',
  'tool monetization',
  'api monetization',
  'mcp monetization',
  'mcp billing',
  'mcp marketplace',
  'ai marketplace',
  'ai tool marketplace',
  // Competitors and protocols
  'settlegrid',
  'xpay',
  'nevermined',
  'stripe mpp',
  'machine payments',
  'x402',
  'L402',
  'agent-to-agent payment',
  'a2a payment',
  // Discovery signals
  'how to charge',
  'how do i monetize',
  'best way to monetize',
  'monetize my mcp',
  'monetize my api',
  'monetize my model',
  'sell api access',
  'charge per request',
  'micropayment',
] as const

/** Posts older than 24 hours are ignored */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Redis key TTL for dedup: 7 days */
const DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RedditPost {
  id: string
  title: string
  selftext: string
  url: string
  permalink: string
  author: string
  subreddit: string
  created_utc: number
}

interface RedditMatch {
  postId: string
  subreddit: string
  title: string
  url: string
  author: string
  matchedKeyword: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Fetches recent posts from a subreddit using Reddit's public JSON API.
 * No authentication required for public subreddits.
 */
async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=25`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      }
    )

    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn('cron.reddit.fetch_failed', { subreddit, status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    const listing = data as { data?: { children?: unknown[] } }
    const children = listing.data?.children
    if (!Array.isArray(children)) return []

    const posts: RedditPost[] = []
    for (const child of children) {
      if (typeof child !== 'object' || child === null) continue
      const d = (child as { data?: Record<string, unknown> }).data
      if (!d) continue

      posts.push({
        id: typeof d.id === 'string' ? d.id : '',
        title: typeof d.title === 'string' ? d.title : '',
        selftext: typeof d.selftext === 'string' ? d.selftext : '',
        url: typeof d.url === 'string' ? d.url : '',
        permalink: typeof d.permalink === 'string' ? `https://www.reddit.com${d.permalink}` : '',
        author: typeof d.author === 'string' ? d.author : '[deleted]',
        subreddit: typeof d.subreddit === 'string' ? d.subreddit : subreddit,
        created_utc: typeof d.created_utc === 'number' ? d.created_utc : 0,
      })
    }

    return posts
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('cron.reddit.fetch_error', {
      subreddit,
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * Checks if a post matches any monetization keywords.
 * Returns the first matched keyword, or null if no match.
 */
function findMonetizationKeyword(post: RedditPost): string | null {
  const searchText = `${post.title} ${post.selftext}`.toLowerCase()
  for (const keyword of MONETIZATION_KEYWORDS) {
    if (searchText.includes(keyword)) return keyword
  }
  return null
}

/**
 * Sends an alert email about a Reddit post mentioning MCP monetization.
 */
async function sendRedditAlertEmail(match: RedditMatch): Promise<void> {
  const subject = sanitizeSubject(
    `Reddit: MCP monetization discussion in r/${match.subreddit}`
  )

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">New Reddit Post About MCP Monetization</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Subreddit:</strong> r/${escapeHtml(match.subreddit)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Title:</strong> ${escapeHtml(match.title)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Author:</strong> u/${escapeHtml(match.author)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Matched keyword:</strong> "${escapeHtml(match.matchedKeyword)}"</p>
<p style="margin:16px 0"><a href="${escapeHtml(match.url)}" style="color:#E5A336;font-weight:600;text-decoration:underline">View Post on Reddit</a></p>
`,
    { preheader: `New MCP monetization discussion: ${match.title.slice(0, 60)}` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: monitors Reddit for MCP monetization discussions.
 * Schedule: every 4 hours
 *
 * Scans r/mcp, r/ClaudeAI, r/langchain for posts containing monetization keywords.
 * Sends alert emails for new matches and deduplicates via Redis.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-monitor-reddit:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.reddit.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const redis = getRedis()
    const now = Date.now()
    const cutoff = now - MAX_AGE_MS

    let totalScanned = 0
    let totalMatched = 0
    let totalAlerted = 0
    let totalDuplicates = 0

    for (const subreddit of SUBREDDITS) {
      const posts = await fetchSubredditPosts(subreddit)

      for (const post of posts) {
        // Skip posts older than 24 hours
        if (post.created_utc * 1000 < cutoff) continue
        if (!post.id) continue

        totalScanned++

        const matchedKeyword = findMonetizationKeyword(post)
        if (!matchedKeyword) continue

        totalMatched++

        const match: RedditMatch = {
          postId: post.id,
          subreddit: post.subreddit,
          title: post.title,
          url: post.permalink || post.url,
          author: post.author,
          matchedKeyword,
        }

        // Dedup check
        const dedupKey = `reddit:alerted:${post.id}`
        const alreadyAlerted = await redis.get<string>(dedupKey)
        if (alreadyAlerted) {
          totalDuplicates++
          continue
        }

        // Log the match
        logger.info('reddit.monetization_post_found', {
          subreddit: match.subreddit,
          title: match.title,
          url: match.url,
          author: match.author,
          matchedKeyword: match.matchedKeyword,
        })

        // Send alert email
        try {
          await sendRedditAlertEmail(match)
          totalAlerted++
        } catch (emailErr) {
          logger.error('cron.reddit.email_failed', { postId: post.id }, emailErr)
        }

        // Mark as alerted with 7-day TTL
        await redis.set(dedupKey, '1', { ex: DEDUP_TTL_SECONDS })
      }
    }

    logger.info('cron.reddit.completed', {
      subreddits: SUBREDDITS.length,
      totalScanned,
      totalMatched,
      totalAlerted,
      totalDuplicates,
    })

    return successResponse({
      subreddits: SUBREDDITS.length,
      totalScanned,
      totalMatched,
      totalAlerted,
      totalDuplicates,
    })
  } catch (error) {
    logger.error('cron.reddit.failed', {}, error)
    return internalErrorResponse(error)
  }
}
