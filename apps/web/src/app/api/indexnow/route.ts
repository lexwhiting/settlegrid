import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// ─── Constants ──────────────────────────────────────────────────────────────────

const INDEXNOW_KEY = 'b7f4e2a1c9d84f6e8a3b5c7d9e1f0a2b'
const INDEXNOW_HOST = 'settlegrid.ai'
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`
const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow'
const MAX_URLS_PER_BATCH = 10_000
const MAX_URL_LENGTH = 2048

// ─── Input Validation ───────────────────────────────────────────────────────────

const submitUrlsSchema = z.object({
  urls: z
    .array(
      z
        .string()
        .url()
        .max(MAX_URL_LENGTH)
        .refine(
          (url) => url.startsWith(`https://${INDEXNOW_HOST}/`),
          { message: `URLs must belong to ${INDEXNOW_HOST}` }
        )
    )
    .min(1, 'At least one URL is required')
    .max(MAX_URLS_PER_BATCH, `Maximum ${MAX_URLS_PER_BATCH} URLs per request`),
})

// ─── Helpers ────────────────────────────────────────────────────────────────────

interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

interface IndexNowResult {
  submitted: number
  status: number
  ok: boolean
}

/**
 * Submits a batch of URLs to the IndexNow API.
 * IndexNow distributes notifications to Bing, Yandex, and other participating engines.
 *
 * Response codes:
 *   200 — URL submitted successfully
 *   202 — URL received, will be verified later
 *   400 — Invalid request
 *   403 — Key not valid (key file not found or mismatched)
 *   422 — Invalid URL (not belonging to the host)
 *   429 — Too many requests (rate limited)
 */
async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const payload: IndexNowPayload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: urls,
  }

  const response = await fetch(INDEXNOW_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })

  return {
    submitted: urls.length,
    status: response.status,
    ok: response.status === 200 || response.status === 202,
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/indexnow
 *
 * Submits URLs to IndexNow for rapid indexing by Bing, Yandex, and other
 * participating search engines. Protected by CRON_SECRET to prevent abuse.
 *
 * Request body:
 *   { "urls": ["https://settlegrid.ai/tools/wikipedia", ...] }
 *
 * Response:
 *   { "submitted": 42, "status": 200, "ok": true }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `indexnow:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET (fail-closed)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('indexnow.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Parse and validate body
    const { urls } = await parseBody(request, submitUrlsSchema)

    logger.info('indexnow.submitting', { urlCount: urls.length })

    // Submit to IndexNow
    const result = await submitToIndexNow(urls)

    if (!result.ok) {
      logger.warn('indexnow.rejected', {
        status: result.status,
        urlCount: urls.length,
      })
      return errorResponse(
        `IndexNow API returned status ${result.status}`,
        502,
        'INDEXNOW_REJECTED',
        undefined,
        { indexNowStatus: result.status }
      )
    }

    logger.info('indexnow.submitted', {
      submitted: result.submitted,
      status: result.status,
    })

    return successResponse(result)
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * GET /api/indexnow
 *
 * Returns the IndexNow key for verification purposes.
 * This allows the key to be checked without needing the static file.
 */
export async function GET(): Promise<NextResponse> {
  return new NextResponse(INDEXNOW_KEY, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
