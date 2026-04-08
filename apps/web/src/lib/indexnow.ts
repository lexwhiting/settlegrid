/**
 * IndexNow client for rapid search engine indexing.
 *
 * Notifies Bing, Yandex, and other participating engines when new
 * pages are created so they get indexed within hours instead of days.
 *
 * Used by:
 *   - crawl-registry and crawl-services crons (tool pages)
 *   - Beacon publish workflow via the agent system (blog post pages)
 *
 * Spec: https://www.indexnow.org/documentation
 *
 * Response codes (per spec):
 *   200 OK              — URLs submitted successfully
 *   202 Accepted        — URLs received, will be verified by IndexNow
 *   400 Bad Request     — Invalid request (malformed JSON, missing fields)
 *   403 Forbidden       — Key file not found or content mismatch
 *   422 Unprocessable   — URL not under the declared host
 *   429 Too Many        — Rate limited
 */

import { logger } from '@/lib/logger'

// ─── Constants ──────────────────────────────────────────────────────────────────

const INDEXNOW_KEY = 'b7f4e2a1c9d84f6e8a3b5c7d9e1f0a2b'
const INDEXNOW_HOST = 'settlegrid.ai'
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`
const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow'
const REQUEST_TIMEOUT_MS = 15_000

/** IndexNow protocol cap on URLs per submission (per spec). */
const MAX_URLS_PER_SUBMISSION = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────────

interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export interface IndexNowSubmitResult {
  submitted: number
  status: number
  ok: boolean
}

// ─── Internal: low-level URL submission ─────────────────────────────────────────

/**
 * Submits a pre-built array of fully-qualified URLs to IndexNow.
 *
 * URLs MUST be absolute, MUST start with `https://settlegrid.ai/`, and the
 * caller is responsible for validating them. This function does not parse
 * or transform input — it just packages the payload and posts it.
 *
 * Fire-and-forget: failures are logged but do not throw. Caller is expected
 * to be in a hot path where IndexNow rejection should not break the larger
 * operation (publish flow, crawl cron, etc.).
 */
async function submitUrlsToIndexNow(
  urls: string[],
  source: string,
): Promise<IndexNowSubmitResult | null> {
  if (urls.length === 0) return null

  if (urls.length > MAX_URLS_PER_SUBMISSION) {
    logger.warn('indexnow.batch_too_large', {
      source,
      requested: urls.length,
      cap: MAX_URLS_PER_SUBMISSION,
    })
    // Truncate rather than failing — favor partial submission over zero.
    urls = urls.slice(0, MAX_URLS_PER_SUBMISSION)
  }

  // Validate every URL is under the declared host (IndexNow returns 422
  // for the entire batch if even one URL violates the host constraint).
  const expectedPrefix = `https://${INDEXNOW_HOST}/`
  const offending = urls.filter((u) => !u.startsWith(expectedPrefix))
  if (offending.length > 0) {
    logger.warn('indexnow.host_mismatch', {
      source,
      offendingCount: offending.length,
      sample: offending.slice(0, 3),
    })
    return null
  }

  try {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const result: IndexNowSubmitResult = {
      submitted: urls.length,
      status: response.status,
      ok: response.status === 200 || response.status === 202,
    }

    if (result.ok) {
      logger.info('indexnow.submitted', {
        source,
        count: result.submitted,
        status: result.status,
      })
    } else {
      logger.warn('indexnow.rejected', {
        source,
        count: result.submitted,
        status: result.status,
      })
    }

    return result
  } catch (error) {
    logger.warn('indexnow.submit_failed', {
      source,
      count: urls.length,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Converts an array of tool slugs into absolute URLs and submits them
 * to IndexNow for rapid indexing.
 *
 * This is a fire-and-forget operation: failures are logged but do not
 * throw. Crawl crons should not fail because IndexNow is temporarily
 * unavailable.
 *
 * @param slugs - Tool slugs to submit (e.g. ["wikipedia", "github-search"])
 * @returns Submission result, or null if no slugs were provided or submission failed
 */
export async function submitToolSlugsToIndexNow(
  slugs: string[]
): Promise<IndexNowSubmitResult | null> {
  if (slugs.length === 0) return null
  const urls = slugs.map((slug) => `https://${INDEXNOW_HOST}/tools/${slug}`)
  return submitUrlsToIndexNow(urls, 'tools')
}

/**
 * Converts an array of blog post slugs into absolute URLs and submits them
 * to IndexNow for rapid indexing.
 *
 * Used by Beacon's publish workflow when a new article ships, and by the
 * one-shot backfill script that submits historical posts whose original
 * publish predated this helper.
 *
 * Fire-and-forget: failures are logged but do not throw. Publish flow
 * should not fail because IndexNow is temporarily unavailable — the post
 * is already live in the database, only the search-engine ping is missing.
 *
 * @param slugs - Blog post slugs (e.g. ["mcp-server-payment-retry-logic"])
 * @returns Submission result, or null if no slugs were provided or submission failed
 */
export async function submitBlogSlugsToIndexNow(
  slugs: string[]
): Promise<IndexNowSubmitResult | null> {
  if (slugs.length === 0) return null
  const urls = slugs.map(
    (slug) => `https://${INDEXNOW_HOST}/learn/blog/${slug}`
  )
  return submitUrlsToIndexNow(urls, 'blog')
}
