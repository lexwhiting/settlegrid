/**
 * settlegrid-tennis — Tennis MCP Server
 *
 * ATP/WTA tennis scores, rankings, and schedules via ESPN.
 *
 * Methods:
 *   search_players(query)         — Search tennis players by name  (1¢)
 *   get_scoreboard(league)        — Get current tennis scores  (1¢)
 *   get_rankings(league)          — Get current ATP/WTA rankings  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPlayersInput {
  query: string
}

interface GetScoreboardInput {
  league?: string
}

interface GetRankingsInput {
  league?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-tennis/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tennis API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tennis',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_scoreboard: { costCents: 1, displayName: 'Get Scoreboard' },
      get_rankings: { costCents: 1, displayName: 'Get Rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlayers = sg.wrap(async (args: SearchPlayersInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/atp/athletes?search=${encodeURIComponent(query)}`)
  const items = (data.athletes ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        displayName: item.displayName,
        citizenship: item.citizenship,
    })),
  }
}, { method: 'search_players' })

const getScoreboard = sg.wrap(async (args: GetScoreboardInput) => {
  const league = typeof args.league === 'string' ? args.league.trim() : ''
  const data = await apiFetch<any>(`/atp/scoreboard`)
  const items = (data.events ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        date: item.date,
        status: item.status,
    })),
  }
}, { method: 'get_scoreboard' })

const getRankings = sg.wrap(async (args: GetRankingsInput) => {
  const league = typeof args.league === 'string' ? args.league.trim() : ''
  const data = await apiFetch<any>(`/atp/rankings`)
  const items = (data.rankings ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        rank: item.rank,
        athlete: item.athlete,
        points: item.points,
    })),
  }
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlayers, getScoreboard, getRankings }

console.log('settlegrid-tennis MCP server ready')
console.log('Methods: search_players, get_scoreboard, get_rankings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
