/**
 * settlegrid-igdb — IGDB Video Game MCP Server
 *
 * Methods:
 *   search_games(query)    — Search games     (2¢)
 *   get_game(game_id)      — Game details     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetGameInput { game_id: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.igdb.com/v4'
const CLIENT_ID = process.env.TWITCH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || ''

let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required')
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' })
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function igdbFetch<T>(endpoint: string, body: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`IGDB API ${res.status}: ${text.slice(0, 200)}`)
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
      get_game: { costCents: 2, displayName: 'Get Game Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await igdbFetch<Array<{ id: number; name: string; summary: string; rating: number; first_release_date: number; genres: Array<{ name: string }> }>>('games', `search "${args.query.replace(/"/g, '')}"; fields name,summary,rating,first_release_date,genres.name; limit 10;`)
  return {
    query: args.query,
    games: data.map((g) => ({
      id: g.id,
      name: g.name,
      summary: g.summary?.slice(0, 300),
      rating: g.rating ? Math.round(g.rating * 10) / 10 : null,
      releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split('T')[0] : null,
      genres: g.genres?.map((ge) => ge.name),
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (typeof args.game_id !== 'number' || args.game_id <= 0) throw new Error('game_id must be a positive number')
  const data = await igdbFetch<Array<{ id: number; name: string; summary: string; storyline: string; rating: number; aggregated_rating: number; first_release_date: number; genres: Array<{ name: string }>; platforms: Array<{ name: string }> }>>('games', `where id = ${args.game_id}; fields name,summary,storyline,rating,aggregated_rating,first_release_date,genres.name,platforms.name;`)
  if (!data.length) throw new Error(`Game not found: ${args.game_id}`)
  const g = data[0]
  return {
    id: g.id,
    name: g.name,
    summary: g.summary,
    storyline: g.storyline?.slice(0, 500),
    userRating: g.rating ? Math.round(g.rating * 10) / 10 : null,
    criticRating: g.aggregated_rating ? Math.round(g.aggregated_rating * 10) / 10 : null,
    releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split('T')[0] : null,
    genres: g.genres?.map((ge) => ge.name),
    platforms: g.platforms?.map((p) => p.name),
  }
}, { method: 'get_game' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame }

console.log('settlegrid-igdb MCP server ready')
console.log('Methods: search_games, get_game')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
