/**
 * settlegrid-chuck-norris — Chuck Norris Jokes MCP Server
 *
 * Get random Chuck Norris jokes from the Chuck Norris API.
 *
 * Methods:
 *   get_random()                  — Get a random Chuck Norris joke  (1¢)
 *   search_jokes(query)           — Search jokes by keyword  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {

}

interface SearchJokesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.chucknorris.io/jokes'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-chuck-norris/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chuck Norris Jokes API ${res.status}: ${body.slice(0, 200)}`)
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
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const data = await apiFetch<any>(`/random`)
  return {
    id: data.id,
    value: data.value,
    categories: data.categories,
    url: data.url,
  }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchJokesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?query=${encodeURIComponent(query)}`)
  const items = (data.result ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        value: item.value,
        categories: item.categories,
    })),
  }
}, { method: 'search_jokes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes }

console.log('settlegrid-chuck-norris MCP server ready')
console.log('Methods: get_random, search_jokes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
