/**
 * settlegrid-nba-stats — NBA Stats MCP Server
 *
 * NBA player and team statistics from the BallDontLie API.
 *
 * Methods:
 *   search_players(query)         — Search NBA players by name  (1¢)
 *   get_teams()                   — List all NBA teams  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPlayersInput {
  query: string
}

interface GetTeamsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.balldontlie.io/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nba-stats/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NBA Stats API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nba-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
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

const getTeams = sg.wrap(async (args: GetTeamsInput) => {

  const data = await apiFetch<any>(`/teams`)
  const items = (data.data ?? []).slice(0, 30)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        full_name: item.full_name,
        abbreviation: item.abbreviation,
        city: item.city,
        conference: item.conference,
        division: item.division,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlayers, getTeams }

console.log('settlegrid-nba-stats MCP server ready')
console.log('Methods: search_players, get_teams')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
