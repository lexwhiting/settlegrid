/**
 * IndexNow client for rapid search engine indexing.
 *
 * Notifies Bing, Yandex, and other participating engines when new
 * pages are created so they get indexed within hours instead of days.
 *
 * Used by crawl-registry and crawl-services crons to submit newly
 * discovered tool pages immediately after insertion.
 */

import { logger } from '@/lib/logger'

// ─── Constants ──────────────────────────────────────────────────────────────────

const INDEXNOW_KEY = 'b7f4e2a1c9d84f6e8a3b5c7d9e1f0a2b'
const INDEXNOW_HOST = 'settlegrid.ai'
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`
const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow'
const REQUEST_TIMEOUT_MS = 15_000

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
      logger.info('indexnow.tools_submitted', {
        count: result.submitted,
        status: result.status,
      })
    } else {
      logger.warn('indexnow.tools_rejected', {
        count: result.submitted,
        status: result.status,
      })
    }

    return result
  } catch (error) {
    // Fire-and-forget: do not let IndexNow failures break crawl crons
    logger.warn('indexnow.submit_failed', {
      count: slugs.length,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
