/**
 * settlegrid-quotable — Random Quotes MCP Server
 *
 * Wraps the Quotable API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_quote(tags)       — Random quote      (1¢)
 *   search_quotes(query, limit)  — Search quotes     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput {
  tags?: string
}

interface SearchInput {
  query: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const QUOTE_BASE = 'https://api.quotable.io'

async function quoteFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${QUOTE_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Quotable API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'quotable',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_quote: { costCents: 1, displayName: 'Random Quote' },
      search_quotes: { costCents: 1, displayName: 'Search Quotes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandomQuote = sg.wrap(async (args: RandomInput) => {
  let url = '/random'
  if (args.tags) url += `?tags=${encodeURIComponent(args.tags)}`
  const data = await quoteFetch<any>(url)
  return {
    id: data._id,
    content: data.content,
    author: data.author,
    tags: data.tags,
    length: data.length,
  }
}, { method: 'get_random_quote' })

const searchQuotes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await quoteFetch<{ count: number; results: any[] }>(
    `/search/quotes?query=${q}&limit=${limit}`
  )
  return {
    query: args.query,
    count: data.count,
    quotes: data.results.map((q: any) => ({
      id: q._id,
      content: q.content,
      author: q.author,
      tags: q.tags,
    })),
  }
}, { method: 'search_quotes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandomQuote, searchQuotes }

console.log('settlegrid-quotable MCP server ready')
console.log('Methods: get_random_quote, search_quotes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
