/**
 * settlegrid-dad-jokes — Dad Jokes MCP Server
 *
 * Methods:
 *   get_random()           — Random dad joke     (1¢)
 *   search_jokes(query)    — Search jokes        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://icanhazdadjoke.com'

async function dadFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-dad-jokes/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Dad Jokes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dad-jokes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random: { costCents: 1, displayName: 'Random Dad Joke' },
      search_jokes: { costCents: 1, displayName: 'Search Jokes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async () => {
  const data = await dadFetch<{ id: string; joke: string }>('/')
  return { id: data.id, joke: data.joke }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await dadFetch<{ results: Array<{ id: string; joke: string }>; total_jokes: number }>(`/search?term=${q}&limit=10`)
  return {
    query: args.query,
    total: data.total_jokes,
    jokes: data.results.map((j) => ({ id: j.id, joke: j.joke })),
  }
}, { method: 'search_jokes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes }

console.log('settlegrid-dad-jokes MCP server ready')
console.log('Methods: get_random, search_jokes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
