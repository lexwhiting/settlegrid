/**
 * settlegrid-igdb — IGDB (Internet Game Database) MCP Server
 *
 * Search video game data — titles, ratings, platforms via the IGDB API.
 *
 * Methods:
 *   search_games(query)           — Search video games by name  (2¢)
 *   get_game(id)                  — Get game details by ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchGamesInput {
  query: string
}

interface GetGameInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.igdb.com/v4'
const API_KEY = process.env.IGDB_BEARER_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-igdb/1.0', 'Authorization': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IGDB (Internet Game Database) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'igdb',
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
  const data = await apiFetch<any>(`/games?search=${encodeURIComponent(query)}&fields=id,name,rating,first_release_date,platforms,summary&limit=10`)
  return {
    id: data.id,
    name: data.name,
    rating: data.rating,
    first_release_date: data.first_release_date,
    summary: data.summary,
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/games/${id}?fields=id,name,rating,summary,storyline,genres,platforms,first_release_date`)
  return {
    id: data.id,
    name: data.name,
    rating: data.rating,
    summary: data.summary,
    genres: data.genres,
    platforms: data.platforms,
  }
}, { method: 'get_game' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame }

console.log('settlegrid-igdb MCP server ready')
console.log('Methods: search_games, get_game')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
