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
const SE_API_KEY = process.env.STACKEXCHANGE_API_KEY // optional, for higher rate limits

/** Tags to search on Stack Overflow (combined with OR via semicolons) */
const TAG_GROUPS = [
  'mcp;billing',
  'ai-tools',
  'api-monetization',
  'langchain',
] as const

/** Keywords that indicate monetization or relevant AI tool discussion */
const MONETIZATION_KEYWORDS = [
  'monetize',
  'billing',
  'charge for',
  'paid api',
  'per-call',
  'per call',
  'usage-based',
  'metering',
  'agent payment',
  'tool monetization',
  'api monetization',
  'mcp billing',
  'mcp marketplace',
  'ai marketplace',
  'how to charge',
  'micropayment',
  'settlegrid',
  'machine payments',
  'x402',
] as const

/** Redis key TTL for dedup: 7 days */
const DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60

/** Posts older than 24 hours are ignored */
const MAX_AGE_SECONDS = 24 * 60 * 60

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SOQuestion {
  question_id: number
  title: string
  body: string
  link: string
  tags: string[]
  owner: {
    display_name: string
  }
  creation_date: number
}

interface SOSearchResponse {
  items: SOQuestion[]
  has_more: boolean
  quota_remaining: number
}

interface SOMatch {
  questionId: number
  title: string
  url: string
  author: string
  tags: string[]
  matchedKeyword: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Searches Stack Overflow for recent questions matching a tag group.
 */
async function searchStackOverflow(tagged: string): Promise<SOQuestion[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const nowSeconds = Math.floor(Date.now() / 1000)
    const fromDate = nowSeconds - MAX_AGE_SECONDS

    const url = new URL('https://api.stackexchange.com/2.3/search')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('sort', 'creation')
    url.searchParams.set('tagged', tagged)
    url.searchParams.set('site', 'stackoverflow')
    url.searchParams.set('filter', 'withbody')
    url.searchParams.set('pagesize', '10')
    url.searchParams.set('fromdate', String(fromDate))
    if (SE_API_KEY) {
      url.searchParams.set('key', SE_API_KEY)
    }

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn('cron.stackoverflow.fetch_failed', { tagged, status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return []

    const parsed = data as Partial<SOSearchResponse>
    if (!Array.isArray(parsed.items)) return []

    const questions: SOQuestion[] = []
    for (const item of parsed.items) {
      if (typeof item !== 'object' || item === null) continue
      const q = item as Partial<SOQuestion>
      questions.push({
        question_id: typeof q.question_id === 'number' ? q.question_id : 0,
        title: typeof q.title === 'string' ? q.title : '',
        body: typeof q.body === 'string' ? q.body : '',
        link: typeof q.link === 'string' ? q.link : '',
        tags: Array.isArray(q.tags) ? q.tags.filter((t): t is string => typeof t === 'string') : [],
        owner: {
          display_name:
            typeof q.owner === 'object' && q.owner !== null && typeof (q.owner as Record<string, unknown>).display_name === 'string'
              ? (q.owner as { display_name: string }).display_name
              : 'anonymous',
        },
        creation_date: typeof q.creation_date === 'number' ? q.creation_date : 0,
      })
    }

    return questions
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('cron.stackoverflow.fetch_error', {
      tagged,
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/**
 * Checks if a question matches any monetization keywords.
 * Returns the first matched keyword, or null if no match.
 */
function findMonetizationKeyword(question: SOQuestion): string | null {
  const searchText = `${question.title} ${question.body}`.toLowerCase()
  for (const keyword of MONETIZATION_KEYWORDS) {
    if (searchText.includes(keyword)) return keyword
  }
  return null
}

/**
 * Sends an alert email about a Stack Overflow question.
 */
async function sendSOAlertEmail(match: SOMatch): Promise<void> {
  const subject = sanitizeSubject(
    `Stack Overflow: MCP monetization question [${match.tags.slice(0, 3).join(', ')}]`
  )

  const html = baseEmailTemplate(
    `
<h2 class="sg-heading" style="color:#1A1F3A;margin:0 0 16px">New Stack Overflow Question About MCP Monetization</h2>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Title:</strong> ${escapeHtml(match.title)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Author:</strong> ${escapeHtml(match.author)}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Tags:</strong> ${match.tags.map((t) => escapeHtml(t)).join(', ')}</p>
<p class="sg-text" style="color:#4b5563;line-height:1.6;margin:0 0 8px"><strong>Matched keyword:</strong> "${escapeHtml(match.matchedKeyword)}"</p>
<p style="margin:16px 0"><a href="${escapeHtml(match.url)}" style="color:#E5A336;font-weight:600;text-decoration:underline">View Question on Stack Overflow</a></p>
`,
    { preheader: `SO question: ${match.title.slice(0, 60)}` }
  )

  await sendEmail({ to: ADMIN_EMAIL, subject, html })
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: monitors Stack Overflow for MCP monetization questions.
 * Schedule: every 6 hours
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-monitor-so:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.stackoverflow.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const redis = getRedis()

    let totalScanned = 0
    let totalMatched = 0
    let totalAlerted = 0
    let totalDuplicates = 0

    for (const tagGroup of TAG_GROUPS) {
      const questions = await searchStackOverflow(tagGroup)

      for (const question of questions) {
        if (!question.question_id) continue
        totalScanned++

        const matchedKeyword = findMonetizationKeyword(question)
        if (!matchedKeyword) continue
        totalMatched++

        const match: SOMatch = {
          questionId: question.question_id,
          title: question.title,
          url: question.link,
          author: question.owner.display_name,
          tags: question.tags,
          matchedKeyword,
        }

        // Dedup check
        const dedupKey = `so:alerted:${question.question_id}`
        const alreadyAlerted = await redis.get<string>(dedupKey)
        if (alreadyAlerted) {
          totalDuplicates++
          continue
        }

        logger.info('stackoverflow.monetization_question_found', {
          questionId: match.questionId,
          title: match.title,
          url: match.url,
          matchedKeyword: match.matchedKeyword,
        })

        try {
          await sendSOAlertEmail(match)
          totalAlerted++
        } catch (emailErr) {
          logger.error('cron.stackoverflow.email_failed', { questionId: question.question_id }, emailErr)
        }

        // Mark as alerted with 7-day TTL
        await redis.set(dedupKey, '1', { ex: DEDUP_TTL_SECONDS })
      }
    }

    logger.info('cron.stackoverflow.completed', {
      tagGroups: TAG_GROUPS.length,
      totalScanned,
      totalMatched,
      totalAlerted,
      totalDuplicates,
    })

    return successResponse({
      tagGroups: TAG_GROUPS.length,
      totalScanned,
      totalMatched,
      totalAlerted,
      totalDuplicates,
    })
  } catch (error) {
    logger.error('cron.stackoverflow.failed', {}, error)
    return internalErrorResponse(error)
  }
}
