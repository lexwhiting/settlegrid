/**
 * settlegrid-rawg — RAWG Video Games MCP Server
 *
 * Search and browse video game data from the RAWG database.
 *
 * Methods:
 *   search_games(query)           — Search video games by name  (2¢)
 *   get_game(id)                  — Get game details by ID or slug  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchGamesInput {
  query: string
}

interface GetGameInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.rawg.io/api'
const API_KEY = process.env.RAWG_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-rawg/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RAWG Video Games API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rawg',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_games: { costCents: 2, displayName: 'Search Games' },
      get_game: { costCents: 2, displayName: 'Get Game' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchGamesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/games?search=${encodeURIComponent(query)}&page_size=10&key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        released: item.released,
        rating: item.rating,
        metacritic: item.metacritic,
        platforms: item.platforms,
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/games/${encodeURIComponent(id)}?key=${API_KEY}`)
  return {
    id: data.id,
    name: data.name,
    released: data.released,
    rating: data.rating,
    metacritic: data.metacritic,
    description_raw: data.description_raw,
    platforms: data.platforms,
    genres: data.genres,
  }
}, { method: 'get_game' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame }

console.log('settlegrid-rawg MCP server ready')
console.log('Methods: search_games, get_game')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
