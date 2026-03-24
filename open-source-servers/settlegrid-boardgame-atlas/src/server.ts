/**
 * settlegrid-boardgame-atlas — Board Game Atlas MCP Server
 *
 * Methods:
 *   search_games(query)  — Search board games    (2¢)
 *   get_mechanics()      — List mechanics        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.boardgameatlas.com/api'
const CLIENT_ID = process.env.BGA_CLIENT_ID || ''

async function bgaFetch<T>(path: string): Promise<T> {
  if (!CLIENT_ID) throw new Error('BGA_CLIENT_ID environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}client_id=${CLIENT_ID}`)
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
      search_games: { costCents: 2, displayName: 'Search Board Games' },
      get_mechanics: { costCents: 1, displayName: 'Get Mechanics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGames = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await bgaFetch<{ games: Array<{ id: string; name: string; year_published: number; min_players: number; max_players: number; min_playtime: number; max_playtime: number; average_user_rating: number; description_preview: string; image_url: string }> }>(`/search?name=${q}&limit=10`)
  return {
    query: args.query,
    count: data.games?.length || 0,
    games: (data.games || []).map((g) => ({
      id: g.id,
      name: g.name,
      yearPublished: g.year_published,
      players: `${g.min_players}-${g.max_players}`,
      playtime: `${g.min_playtime}-${g.max_playtime} min`,
      rating: g.average_user_rating ? Math.round(g.average_user_rating * 100) / 100 : null,
      description: g.description_preview?.slice(0, 300),
      image: g.image_url,
    })),
  }
}, { method: 'search_games' })

const getMechanics = sg.wrap(async () => {
  const data = await bgaFetch<{ mechanics: Array<{ id: string; name: string }> }>('/game/mechanics')
  return { mechanics: data.mechanics || [] }
}, { method: 'get_mechanics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGames, getMechanics }

console.log('settlegrid-boardgame-atlas MCP server ready')
console.log('Methods: search_games, get_mechanics')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
