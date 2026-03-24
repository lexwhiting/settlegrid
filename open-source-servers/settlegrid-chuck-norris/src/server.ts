/**
 * settlegrid-chuck-norris — Chuck Norris Jokes MCP Server
 *
 * Methods:
 *   get_random(category?)   — Random joke        (1¢)
 *   search_jokes(query)     — Search jokes       (1¢)
 *   get_categories()        — List categories    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput { category?: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.chucknorris.io'

async function cnFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chuck Norris API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chuck-norris',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Joke' },
      search_jokes: { costCents: 1, displayName: 'Search Jokes' },
      get_categories: { costCents: 1, displayName: 'Get Categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: RandomInput) => {
  const catParam = args.category ? `?category=${encodeURIComponent(args.category)}` : ''
  const data = await cnFetch<{ id: string; value: string; categories: string[]; url: string }>(`/jokes/random${catParam}`)
  return { id: data.id, joke: data.value, categories: data.categories, url: data.url }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  if (args.query.trim().length < 3) throw new Error('query must be at least 3 characters')
  const q = encodeURIComponent(args.query.trim())
  const data = await cnFetch<{ total: number; result: Array<{ id: string; value: string; categories: string[] }> }>(`/jokes/search?query=${q}`)
  return {
    query: args.query,
    total: data.total,
    jokes: data.result.slice(0, 10).map((j) => ({
      id: j.id,
      joke: j.value,
      categories: j.categories,
    })),
  }
}, { method: 'search_jokes' })

const getCategories = sg.wrap(async () => {
  const data = await cnFetch<string[]>('/jokes/categories')
  return { categories: data }
}, { method: 'get_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes, getCategories }

console.log('settlegrid-chuck-norris MCP server ready')
console.log('Methods: get_random, search_jokes, get_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
