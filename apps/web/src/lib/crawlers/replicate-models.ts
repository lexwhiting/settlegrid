/**
 * Replicate Models Crawler for SettleGrid.
 *
 * Crawls the public Replicate API for popular ML models sorted by
 * run count. These represent inference endpoints that could be
 * wrapped with SettleGrid billing (image generation, LLMs, etc.).
 *
 * Uses the public Replicate API — no authentication required for
 * listing models. Enforces a 10-second timeout and returns an
 * empty array on failure.
 */

import { logger } from '@/lib/logger'
import type { CrawledServer } from '@/lib/registry-crawlers'

// ─── Constants ──────────────────────────────────────────────────────────────

const REPLICATE_API_URL = 'https://api.replicate.com/v1/models'
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Replicate response shapes ──────────────────────────────────────────────

interface ReplicateModel {
  url?: string
  owner?: string
  name?: string
  description?: string
  run_count?: number
  cover_image_url?: string
  github_url?: string
  visibility?: string
}

interface ReplicateListResponse {
  results?: ReplicateModel[]
  next?: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Crawls Replicate for popular models. Returns up to `limit` normalized
 * results sorted by run count (most popular first).
 */
export async function crawlReplicateModels(limit: number): Promise<CrawledServer[]> {
  try {
    const url = new URL(REPLICATE_API_URL)
    // Replicate's public collection endpoint — we request a generous page
    // since the API may not support sort=run_count directly
    url.searchParams.set('page_size', String(Math.min(limit * 2, 100)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.replicate.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      logger.warn('crawler.replicate.unexpected_format', {
        msg: 'Expected object response',
      })
      return []
    }

    const response = data as ReplicateListResponse

    // Replicate may return { results: [...] } or a top-level array
    const models: unknown[] = Array.isArray(response.results)
      ? response.results
      : Array.isArray(data)
        ? (data as unknown[])
        : []

    if (models.length === 0) {
      logger.info('crawler.replicate.no_data', { msg: 'API returned 0 models' })
      return []
    }

    // Sort by run count descending (in case API doesn't sort for us)
    const typed = models.filter(
      (m): m is ReplicateModel => typeof m === 'object' && m !== null,
    )
    typed.sort((a, b) => {
      const aRuns = typeof a.run_count === 'number' && Number.isFinite(a.run_count) ? a.run_count : 0
      const bRuns = typeof b.run_count === 'number' && Number.isFinite(b.run_count) ? b.run_count : 0
      return bRuns - aRuns
    })

    const results: CrawledServer[] = []
    const seen = new Set<string>()

    for (const model of typed) {
      if (results.length >= limit) break

      const owner = typeof model.owner === 'string' ? model.owner.trim() : ''
      const name = typeof model.name === 'string' ? model.name.trim() : ''

      if (!owner || !name) continue

      // Deduplicate by owner/name
      const key = `${owner}/${name}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const runCount =
        typeof model.run_count === 'number' && Number.isFinite(model.run_count)
          ? model.run_count
          : 0

      const rawDescription =
        typeof model.description === 'string'
          ? model.description.trim()
          : ''

      const descParts = [
        rawDescription,
        `By ${owner}.`,
        `${runCount.toLocaleString()} runs.`,
      ].filter(Boolean)

      const description = descParts.join(' ').slice(0, 2000)

      const sourceUrl =
        typeof model.github_url === 'string' && model.github_url.length > 0
          ? model.github_url
          : typeof model.url === 'string' && model.url.length > 0
            ? model.url
            : `https://replicate.com/${owner}/${name}`

      results.push({
        name: `replicate-${owner}-${name}`,
        description,
        sourceUrl,
        source: 'replicate',
      })
    }

    logger.info('crawler.replicate.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.replicate.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
