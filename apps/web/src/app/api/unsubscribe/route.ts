import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { successResponse, errorResponse } from '@/lib/api'
import { db } from '@/lib/db'
import { consumers } from '@/lib/db/schema'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  normalizeEmail,
  isSuppressibleStream,
  suppressBestEffort,
  type SuppressibleStream,
} from '@/lib/email-suppression'

// Runtime pin: writes to Postgres (consumers, email_suppressions) — Node, not edge.
export const runtime = 'nodejs'

const LEGACY_UNSUB_OUTREACH_PREFIX = 'unsub:outreach:'

/**
 * POST/GET /api/unsubscribe — the stream-aware public suppression endpoint.
 *
 * Routes every non-newsletter bulk opt-out (outreach, consumer-digest,
 * weekly-report, abandoned-checkout) through ONE durable key: it writes a
 * `(email, stream)` row to email_suppressions AND, for the outreach stream,
 * keeps writing the legacy Redis `unsub:outreach:` key the crons still union.
 *
 * The address is read from the URL QUERY first — this serves BOTH the browser
 * page's `?email=&type=` links and the RFC-8058 one-click POST (whose address
 * the sender's List-Unsubscribe URL carries in the query). Only a browser
 * JSON POST (no query email) falls back to the JSON body; an
 * application/x-www-form-urlencoded one-click body is NEVER parsed for the
 * address (a form '+' decodes to a space normalizeEmail can't repair — FOLD #8).
 */
async function resolveUnsub(request: NextRequest): Promise<
  | { email: string; stream: SuppressibleStream; source: 'link' | 'list-unsub-post' }
  | null
> {
  const q = request.nextUrl.searchParams
  let rawEmail = q.get('email') ?? ''
  let rawStream = q.get('stream') ?? q.get('type') ?? ''
  let source: 'link' | 'list-unsub-post' = 'link'

  if (rawEmail) {
    // Query-carried address: a one-click POST or a direct GET link click.
    source = request.method === 'POST' ? 'list-unsub-post' : 'link'
  } else if (request.method === 'POST') {
    // Browser-client JSON POST — parse the JSON body (never form-urlencoded).
    try {
      const body = (await request.json()) as {
        email?: unknown
        stream?: unknown
        type?: unknown
      }
      if (typeof body.email === 'string') rawEmail = body.email
      if (!rawStream && typeof body.stream === 'string') rawStream = body.stream
      if (!rawStream && typeof body.type === 'string') rawStream = body.type
    } catch {
      // fall through — validated below
    }
  }

  const email = normalizeEmail(rawEmail)
  if (!email || !email.includes('@') || email.length > 254) return null

  // Default 'outreach' for back-compat with existing bare unsubscribe links
  // (which carry no stream). 'all' is intentionally not suppressible here.
  const stream: SuppressibleStream = isSuppressibleStream(rawStream) ? rawStream : 'outreach'
  return { email, stream, source }
}

async function handleUnsubscribe(request: NextRequest) {
  // apiLimiter (100/min/IP), not authLimiter (5/min): RFC-8058 one-click POSTs
  // arrive from a mailbox provider's shared egress IP, so 5/min would block
  // legitimate unsubscribes; 100/min still bounds the key-flood DoS.
  const rl = await checkRateLimit(apiLimiter, `unsubscribe:${getClientIp(request.headers)}`)
  if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

  const resolved = await resolveUnsub(request)
  if (!resolved) return errorResponse('Invalid email address.', 400, 'INVALID_EMAIL')
  const { email, stream, source } = resolved

  // DURABLE FALLBACK FIRST (FOLD #4) — recorded BEFORE the best-effort table
  // write so a click can never 500 or lose the opt-out, even in the deploy
  // window before email_suppressions exists.
  try {
    if (stream === 'outreach') {
      // The legacy permanent key the outreach crons still read (union side).
      await getRedis().set(`${LEGACY_UNSUB_OUTREACH_PREFIX}${email}`, '1')
    } else if (stream === 'newsletter') {
      // Case-insensitive: consumers.email is stored trimmed but not lowercased.
      await db
        .update(consumers)
        .set({ newsletterSubscribed: false })
        .where(sql`lower(${consumers.email}) = ${email}`)
    }
    // consumer-digest / weekly-report / abandoned-checkout have NO legacy
    // fallback store — the canonical table below is their only sink. On a
    // migration-FIRST deploy (the REQUIRED order) this is fine. CAVEAT: the
    // consumer-digest unsub link already ships at HEAD (email.ts), so those
    // links are already in inboxes — a click during a deploy-BEFORE-migration
    // window hits the best-effort table write, is swallowed, and silently loses
    // the opt-out (200, no row). weekly-report / abandoned-checkout links are
    // net-new here, so no backlog. TODO(email-compliance follow-up): give these
    // three a durable fallback (symmetric with outreach's Redis key) so
    // deploy-first is fully lossless too.
  } catch (err) {
    logger.error('unsubscribe.fallback_failed', { stream }, err)
  }

  // Canonical durable store — best-effort so it never 500s the click.
  await suppressBestEffort(email, stream, 'unsubscribe', source)

  logger.info('unsubscribe.recorded', {
    stream,
    source,
    email: email.slice(0, 3) + '***',
  })
  return successResponse({ unsubscribed: true, stream })
}

export async function POST(request: NextRequest) {
  try {
    return await handleUnsubscribe(request)
  } catch (err) {
    logger.error('unsubscribe.failed', {}, err)
    return errorResponse('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR')
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handleUnsubscribe(request)
  } catch (err) {
    logger.error('unsubscribe.get_failed', {}, err)
    return errorResponse('Something went wrong. Please try again.', 500, 'INTERNAL_ERROR')
  }
}
