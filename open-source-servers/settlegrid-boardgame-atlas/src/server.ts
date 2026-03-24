/**
 * settlegrid-boardgame-atlas — Board Game Atlas MCP Server
 *
 * Search board games, mechanics, and categories from Board Game Atlas.
 *
 * Methods:
 *   search_games(query)           — Search board games by name  (2¢)
 *   get_game(id)                  — Get board game details by ID  (2¢)
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

const BASE = 'https://api.boardgameatlas.com/api'
const API_KEY = process.env.BGA_CLIENT_ID ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-boardgame-atlas/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Board Game Atlas API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'boardgame-atlas',
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
  const data = await apiFetch<any>(`/search?name=${encodeURIComponent(query)}&limit=10&client_id=${API_KEY}`)
  const items = (data.games ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        year_published: item.year_published,
        min_players: item.min_players,
        max_players: item.max_players,
        average_user_rating: item.average_user_rating,
        description_preview: item.description_preview,
    })),
  }
}, { method: 'search_games' })

const getGame = sg.wrap(async (args: GetGameInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/search?ids=${encodeURIComponent(id)}&client_id=${API_KEY}`)
  const items = (data.games ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        year_published: item.year_published,
        min_players: item.min_players,
        max_players: item.max_players,
        average_user_rating: item.average_user_rating,
        description_preview: item.description_preview,
        mechanics: item.mechanics,
    })),
  }
}, { method: 'get_game' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getGame }

console.log('settlegrid-boardgame-atlas MCP server ready')
console.log('Methods: search_games, get_game')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
