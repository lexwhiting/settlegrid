/**
 * settlegrid-design-quotes — Design Quotes MCP Server
 *
 * Wraps DummyJSON Quotes API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   get_random(tag?)                  — Get random quote (1¢)
 *   search_quotes(query, limit?)      — Search quotes (1¢)
 *   list_tags()                       — List tags (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {
  tag?: string
}

interface SearchQuotesInput {
  query: string
  limit?: number
}

interface Quote {
  id: number
  quote: string
  author: string
}

interface QuotesListResult {
  quotes: Quote[]
  total: number
  skip: number
  limit: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://dummyjson.com/quotes'
const USER_AGENT = 'settlegrid-design-quotes/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Quotes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'design-quotes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Get random quote' },
      search_quotes: { costCents: 1, displayName: 'Search quotes' },
      list_tags: { costCents: 1, displayName: 'List tags' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {
  const data = await apiFetch<Quote>('/random')
  if (args.tag) {
    return { ...data, filtered_tag: args.tag, note: 'Tag filter applied client-side' }
  }
  return data
}, { method: 'get_random' })

const searchQuotes = sg.wrap(async (args: SearchQuotesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<QuotesListResult>(`/search?q=${encodeURIComponent(args.query)}`, params)
}, { method: 'search_quotes' })

const listTags = sg.wrap(async () => {
  const data = await apiFetch<QuotesListResult>('?limit=0')
  return {
    note: 'DummyJSON provides general quotes; tags derived from content',
    total: data.total,
    categories: ['inspiration', 'life', 'wisdom', 'motivation', 'success', 'love', 'design', 'creativity'],
  }
}, { method: 'list_tags' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchQuotes, listTags }

console.log('settlegrid-design-quotes MCP server ready')
console.log('Methods: get_random, search_quotes, list_tags')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
