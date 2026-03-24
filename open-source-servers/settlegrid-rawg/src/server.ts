/**
 * settlegrid-rawg — RAWG Video Games MCP Server
 *
 * Methods:
 *   search_games(query)  — Search games      (2¢)
 *   get_game(id)         — Game details      (2¢)
 *   get_genres()         — List genres       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetGameInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.rawg.io/api'
const API_KEY = process.env.RAWG_API_KEY || ''

async function rawgFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('RAWG_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}key=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RAWG API ${res.status}: ${body.slice(0, 200)}`)
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
      get_genres: { costCents: 1, displayName: 'Get Genres' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await rawgFetch<{ count: number; results: Array<{ id: number; slug: string; name: string; released: string; rating: number; metacritic: number; genres: Array<{ name: string }>; platforms: Array<{ platform: { name: string } }> }> }>(`/games?search=${q}&page_size=10`)
  return {
    query: args.query,
    count: data.count,
    games: data.results.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      released: g.released,
      rating: g.rating,
      metacritic: g.metacritic,
      genres: g.genres?.map((ge) => ge.name),
      platforms: g.platforms?.map((p) => p.platform.name),
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required (game ID or slug)')
  const data = await rawgFetch<{ id: number; slug: string; name: string; description_raw: string; released: string; rating: number; metacritic: number; playtime: number; genres: Array<{ name: string }>; platforms: Array<{ platform: { name: string } }>; developers: Array<{ name: string }>; publishers: Array<{ name: string }> }>(`/games/${encodeURIComponent(args.id)}`)
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description_raw?.slice(0, 500),
    released: data.released,
    rating: data.rating,
    metacritic: data.metacritic,
    playtime: data.playtime,
    genres: data.genres?.map((g) => g.name),
    platforms: data.platforms?.map((p) => p.platform.name),
    developers: data.developers?.map((d) => d.name),
    publishers: data.publishers?.map((p) => p.name),
  }
}, { method: 'get_game' })

const getGenres = sg.wrap(async () => {
  const data = await rawgFetch<{ results: Array<{ id: number; name: string; slug: string; games_count: number }> }>('/genres')
  return { genres: data.results.map((g) => ({ id: g.id, name: g.name, slug: g.slug, gamesCount: g.games_count })) }
}, { method: 'get_genres' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame, getGenres }

console.log('settlegrid-rawg MCP server ready')
console.log('Methods: search_games, get_game, get_genres')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
