/**
 * settlegrid-random-quotes — Random Quotes MCP Server
 *
 * Wraps Quotable API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_quote(tag?) — random quote (1¢)
 *   search_quotes(query) — search quotes (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface RandomInput { tag?: string }
interface SearchInput { query: string }

const API_BASE = 'https://api.quotable.io'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'random-quotes',
  pricing: { defaultCostCents: 1, methods: { get_random_quote: { costCents: 1, displayName: 'Random Quote' }, search_quotes: { costCents: 1, displayName: 'Search Quotes' } } },
})

const getRandomQuote = sg.wrap(async (args: RandomInput) => {
  const params = args.tag ? `?tags=${encodeURIComponent(args.tag)}` : ''
  const data = await apiFetch<any>(`/random${params}`)
  return { content: data.content, author: data.author, tags: data.tags, length: data.length, id: data._id }
}, { method: 'get_random_quote' })

const searchQuotes = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(`/search/quotes?query=${encodeURIComponent(args.query)}`)
  return {
    total: data.totalCount,
    quotes: (data.results || []).slice(0, 20).map((q: any) => ({
      content: q.content, author: q.author, tags: q.tags,
    })),
  }
}, { method: 'search_quotes' })

export { getRandomQuote, searchQuotes }

console.log('settlegrid-random-quotes MCP server ready')
console.log('Methods: get_random_quote, search_quotes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
