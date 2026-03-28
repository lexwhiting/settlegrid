/**
 * Hugging Face Spaces Crawler for SettleGrid.
 *
 * Crawls the public Hugging Face Spaces API for spaces with API
 * or inference capabilities. These represent ML model serving
 * endpoints that could be wrapped with SettleGrid billing.
 *
 * Uses the public HF API — no authentication required.
 * Enforces a 10-second timeout and returns an empty array on failure.
 */

import { logger } from '@/lib/logger'
import type { CrawledServer } from '@/lib/registry-crawlers'

// ─── Constants ──────────────────────────────────────────────────────────────

const HF_SPACES_URL = 'https://huggingface.co/api/spaces'
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

/** Tags that indicate the space exposes an API or inference endpoint */
const API_TAGS = new Set(['api', 'inference', 'gradio', 'fastapi', 'docker'])

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

// ─── HF Space response shape ───────────────────────────────────────────────

interface HfSpace {
  id?: string
  author?: string
  cardData?: {
    title?: string
    short_description?: string
    tags?: string[]
  }
  tags?: string[]
  likes?: number
  sdk?: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Crawls Hugging Face Spaces sorted by likes, filtering for spaces
 * with API/inference tags. Returns up to `limit` normalized results.
 */
export async function crawlHuggingFaceSpaces(limit: number): Promise<CrawledServer[]> {
  try {
    const url = new URL(HF_SPACES_URL)
    url.searchParams.set('sort', 'likes')
    url.searchParams.set('direction', '-1')
    url.searchParams.set('limit', String(Math.min(limit * 2, 200))) // Fetch extra since we filter

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.huggingface.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (!Array.isArray(data)) {
      logger.warn('crawler.huggingface.unexpected_format', {
        msg: 'Expected array response',
      })
      return []
    }

    const results: CrawledServer[] = []

    for (const raw of data) {
      if (results.length >= limit) break
      if (typeof raw !== 'object' || raw === null) continue

      const space = raw as HfSpace

      // Must have an id (format: "author/space-name")
      if (typeof space.id !== 'string' || space.id.trim().length === 0) continue

      // Collect all tags from both top-level and cardData
      const allTags: string[] = []
      if (Array.isArray(space.tags)) {
        for (const t of space.tags) {
          if (typeof t === 'string') allTags.push(t.toLowerCase())
        }
      }
      if (Array.isArray(space.cardData?.tags)) {
        for (const t of space.cardData.tags) {
          if (typeof t === 'string') allTags.push(t.toLowerCase())
        }
      }

      // Also consider the SDK as an implicit tag
      if (typeof space.sdk === 'string') {
        allTags.push(space.sdk.toLowerCase())
      }

      // Filter: must have at least one API/inference-related tag
      const hasApiTag = allTags.some((tag) => API_TAGS.has(tag))
      if (!hasApiTag) continue

      const id = space.id.trim()
      const author = typeof space.author === 'string' ? space.author : id.split('/')[0] ?? 'unknown'

      // Build a descriptive name
      const spaceName = id.includes('/') ? id.split('/').slice(1).join('/') : id
      const title =
        typeof space.cardData?.title === 'string' && space.cardData.title.trim().length > 0
          ? space.cardData.title.trim()
          : spaceName

      // Build description including author and likes
      const shortDesc =
        typeof space.cardData?.short_description === 'string'
          ? space.cardData.short_description.trim()
          : ''
      const likes = typeof space.likes === 'number' && Number.isFinite(space.likes) ? space.likes : 0
      const descParts = [shortDesc, `By ${author}.`, `${likes.toLocaleString()} likes.`].filter(Boolean)
      const description = descParts.join(' ').slice(0, 2000)

      results.push({
        name: `hf-${id.replace('/', '-')}`,
        description: `${title}: ${description}`,
        sourceUrl: `https://huggingface.co/spaces/${id}`,
        source: 'huggingface',
      })
    }

    logger.info('crawler.huggingface.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.huggingface.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
