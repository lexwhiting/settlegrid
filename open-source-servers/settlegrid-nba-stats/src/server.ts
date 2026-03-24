/**
 * settlegrid-nba-stats — NBA Stats MCP Server
 *
 * Methods:
 *   search_players(query)  — Search NBA players   (1¢)
 *   get_teams()            — List NBA teams       (1¢)
 *   get_games(date)        — Games by date        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GamesInput { date: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.balldontlie.io/v1'

async function nbaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NBA API ${res.status}: ${body.slice(0, 200)}`)
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
      get_games: { costCents: 1, displayName: 'Get Games' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlayers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await nbaFetch<{ data: Array<{ id: number; first_name: string; last_name: string; position: string; team: { full_name: string; abbreviation: string } }> }>(`/players?search=${q}`)
  return {
    query: args.query,
    count: data.data.length,
    players: data.data.slice(0, 10).map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.position,
      team: p.team?.full_name,
      teamAbbr: p.team?.abbreviation,
    })),
  }
}, { method: 'search_players' })

const getTeams = sg.wrap(async () => {
  const data = await nbaFetch<{ data: Array<{ id: number; abbreviation: string; city: string; conference: string; division: string; full_name: string; name: string }> }>('/teams')
  return {
    count: data.data.length,
    teams: data.data.map((t) => ({
      id: t.id,
      name: t.full_name,
      abbreviation: t.abbreviation,
      city: t.city,
      conference: t.conference,
      division: t.division,
    })),
  }
}, { method: 'get_teams' })

const getGames = sg.wrap(async (args: GamesInput) => {
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error('date must be YYYY-MM-DD')
  const data = await nbaFetch<{ data: Array<{ id: number; date: string; home_team: { full_name: string }; visitor_team: { full_name: string }; home_team_score: number; visitor_team_score: number; status: string }> }>(`/games?dates[]=${args.date}`)
  return {
    date: args.date,
    count: data.data.length,
    games: data.data.map((g) => ({
      id: g.id,
      homeTeam: g.home_team.full_name,
      awayTeam: g.visitor_team.full_name,
      homeScore: g.home_team_score,
      awayScore: g.visitor_team_score,
      status: g.status,
    })),
  }
}, { method: 'get_games' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlayers, getTeams, getGames }

console.log('settlegrid-nba-stats MCP server ready')
console.log('Methods: search_players, get_teams, get_games')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
