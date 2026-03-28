/**
 * SettleGrid Service Template: Search API
 *
 * Wraps a web search engine API (e.g., SerpAPI, Brave Search, Tavily)
 * with per-query billing through SettleGrid. Callers submit a search
 * query and receive structured results without needing their own API key.
 *
 * Pricing: $0.02 per search query (configurable)
 *
 * Usage:
 *   1. `npm install settlegrid`
 *   2. Set SETTLEGRID_SECRET and SEARCH_API_KEY in your environment
 *   3. Deploy and register on SettleGrid dashboard
 */

import { SettleGrid } from 'settlegrid'

// ─── Initialize ─────────────────────────────────────────────────────────────

const sg = new SettleGrid({
  secret: process.env.SETTLEGRID_SECRET!,
})

// ─── Constants ──────────────────────────────────────────────────────────────

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? 'https://api.search.brave.com/res/v1/web/search'
const SEARCH_API_KEY = process.env.SEARCH_API_KEY ?? ''
const FETCH_TIMEOUT_MS = 10_000
const MAX_RESULTS = 20
const MAX_QUERY_LENGTH = 500

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchRequest {
  query: string
  count?: number          // Number of results (1-20, default 10)
  freshness?: string      // Time filter: 'day', 'week', 'month'
  country?: string        // Country code (e.g., 'US', 'GB')
  language?: string       // Language code (e.g., 'en', 'fr')
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  publishedDate?: string
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  totalResults: number
  searchedAt: string
  responseTimeMs: number
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function handleSearch(input: SearchRequest): Promise<SearchResponse> {
  const query = input.query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query is required')
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query too long (${query.length} chars, max ${MAX_QUERY_LENGTH})`)
  }

  const count = Math.min(Math.max(input.count ?? 10, 1), MAX_RESULTS)
  const start = Date.now()

  // Build search request
  const url = new URL(SEARCH_API_URL)
  url.searchParams.set('q', query.trim())
  url.searchParams.set('count', String(count))

  if (input.freshness) url.searchParams.set('freshness', input.freshness)
  if (input.country) url.searchParams.set('country', input.country)
  if (input.language) url.searchParams.set('search_lang', input.language)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': SEARCH_API_KEY,
      },
    })

    if (!res.ok) {
      throw new Error(`Search API returned ${res.status}`)
    }

    const data = (await res.json()) as {
      web?: {
        results?: Array<{
          title?: string
          url?: string
          description?: string
          page_age?: string
        }>
        totalEstimatedMatches?: number
      }
    }

    const webResults = data.web?.results ?? []
    const results: SearchResult[] = webResults
      .filter((r) => typeof r.url === 'string' && typeof r.title === 'string')
      .map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
        publishedDate: r.page_age,
      }))

    const responseTimeMs = Date.now() - start

    return {
      query: query.trim(),
      results,
      totalResults: data.web?.totalEstimatedMatches ?? results.length,
      searchedAt: new Date().toISOString(),
      responseTimeMs,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ─── SettleGrid Wrap ────────────────────────────────────────────────────────

/**
 * sg.wrap() intercepts each request, verifies the caller's SettleGrid
 * API key, charges per-query, and records usage on the SettleGrid ledger.
 */
export default sg.wrap(handleSearch, {
  name: 'search-api',
  pricing: {
    model: 'per-call',
    costCentsPerCall: 2, // $0.02 per search query
  },
  rateLimit: {
    requests: 60,
    window: '1m',
  },
})
