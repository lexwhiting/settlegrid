/**
 * npm AI Package Crawler for SettleGrid.
 *
 * Searches the npm registry for packages with AI SDK dependencies
 * (OpenAI, Anthropic, AI agents, LLMs) and normalizes them into the
 * standard CrawledServer shape for indexing as unclaimed services.
 *
 * Uses the public npm search API — no authentication required.
 * Enforces a 10-second timeout and returns an empty array on failure.
 */

import { logger } from '@/lib/logger'
import type { CrawledServer } from '@/lib/registry-crawlers'

// ─── Constants ──────────────────────────────────────────────────────────────

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search'
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

/** Search queries targeting AI ecosystem packages */
const SEARCH_QUERIES = [
  'keywords:openai+mcp',
  'keywords:anthropic',
  'keywords:ai-agent',
  'keywords:llm',
] as const

/** Max results per query (npm caps at 250) */
const RESULTS_PER_QUERY = 100

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

// ─── npm response types ─────────────────────────────────────────────────────

interface NpmSearchObject {
  package?: {
    name?: string
    description?: string
    links?: {
      repository?: string
      homepage?: string
      npm?: string
    }
    keywords?: string[]
  }
}

interface NpmSearchResponse {
  objects?: NpmSearchObject[]
}

// ─── Single query fetcher ───────────────────────────────────────────────────

async function searchNpm(query: string, size: number): Promise<CrawledServer[]> {
  const url = new URL(NPM_SEARCH_URL)
  url.searchParams.set('text', query)
  url.searchParams.set('size', String(Math.min(size, 250)))

  const res = await fetchWithTimeout(url.toString())
  if (!res.ok) {
    logger.warn('crawler.npm_ai.query_failed', { query, status: res.status })
    return []
  }

  const data = (await res.json()) as NpmSearchResponse
  if (!Array.isArray(data.objects)) return []

  const results: CrawledServer[] = []

  for (const obj of data.objects) {
    const pkg = obj.package
    if (!pkg || typeof pkg.name !== 'string' || pkg.name.trim().length === 0) continue

    const name = pkg.name.trim()
    const description =
      typeof pkg.description === 'string'
        ? pkg.description.trim().slice(0, 2000)
        : ''

    const sourceUrl =
      typeof pkg.links?.repository === 'string'
        ? pkg.links.repository
        : typeof pkg.links?.homepage === 'string'
          ? pkg.links.homepage
          : typeof pkg.links?.npm === 'string'
            ? pkg.links.npm
            : `https://www.npmjs.com/package/${name}`

    results.push({
      name,
      description,
      sourceUrl,
      source: 'npm-ai',
    })
  }

  return results
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Crawls npm for AI-related packages across multiple keyword queries.
 * Deduplicates by package name and returns up to `limit` results.
 */
export async function crawlNpmAiPackages(limit: number): Promise<CrawledServer[]> {
  try {
    const seen = new Set<string>()
    const results: CrawledServer[] = []

    for (const query of SEARCH_QUERIES) {
      if (results.length >= limit) break

      try {
        const remaining = limit - results.length
        const servers = await searchNpm(query, Math.min(remaining, RESULTS_PER_QUERY))

        for (const server of servers) {
          if (results.length >= limit) break

          // Deduplicate by name across queries
          const key = server.name.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)

          results.push(server)
        }

        logger.info('crawler.npm_ai.query_completed', {
          query,
          found: servers.length,
          totalSoFar: results.length,
        })
      } catch (queryErr) {
        // Log but continue to next query
        logger.warn('crawler.npm_ai.query_error', {
          query,
          error: queryErr instanceof Error ? queryErr.message : String(queryErr),
        })
      }
    }

    logger.info('crawler.npm_ai.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.npm_ai.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}
