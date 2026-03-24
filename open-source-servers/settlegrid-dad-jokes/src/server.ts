/**
 * settlegrid-dad-jokes — Dad Jokes MCP Server
 *
 * Get dad jokes from the icanhazdadjoke API.
 *
 * Methods:
 *   get_random()                  — Get a random dad joke  (1¢)
 *   search_jokes(term)            — Search dad jokes by term  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRandomInput {

}

interface SearchJokesInput {
  term: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://icanhazdadjoke.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-dad-jokes/1.0' },
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
      get_random: { costCents: 1, displayName: 'Random Joke' },
      search_jokes: { costCents: 1, displayName: 'Search Jokes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandom = sg.wrap(async (args: GetRandomInput) => {

  const data = await apiFetch<any>(`/`)
  return {
    id: data.id,
    joke: data.joke,
    status: data.status,
  }
}, { method: 'get_random' })

const searchJokes = sg.wrap(async (args: SearchJokesInput) => {
  if (!args.term || typeof args.term !== 'string') throw new Error('term is required')
  const term = args.term.trim()
  const data = await apiFetch<any>(`/search?term=${encodeURIComponent(term)}&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        joke: item.joke,
    })),
  }
}, { method: 'search_jokes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandom, searchJokes }

console.log('settlegrid-dad-jokes MCP server ready')
console.log('Methods: get_random, search_jokes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
