/**
 * settlegrid-balldontlie — BallDontLie (NBA) MCP Server
 *
 * NBA player stats, season averages, and game data.
 *
 * Methods:
 *   search_players(query)         — Search NBA players by name  (1¢)
 *   get_games(date)               — Get NBA games by date  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPlayersInput {
  query: string
}

interface GetGamesInput {
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.balldontlie.io/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-balldontlie/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BallDontLie (NBA) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'balldontlie',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_games: { costCents: 1, displayName: 'Get Games' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlayers = sg.wrap(async (args: SearchPlayersInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/players?search=${encodeURIComponent(query)}&per_page=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        first_name: item.first_name,
        last_name: item.last_name,
        position: item.position,
        team: item.team,
    })),
  }
}, { method: 'search_players' })

const getGames = sg.wrap(async (args: GetGamesInput) => {
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  const date = args.date.trim()
  const data = await apiFetch<any>(`/games?dates[]=${encodeURIComponent(date)}&per_page=15`)
  const items = (data.data ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        date: item.date,
        home_team: item.home_team,
        visitor_team: item.visitor_team,
        home_team_score: item.home_team_score,
        visitor_team_score: item.visitor_team_score,
    })),
  }
}, { method: 'get_games' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlayers, getGames }

console.log('settlegrid-balldontlie MCP server ready')
console.log('Methods: search_players, get_games')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
