/**
 * settlegrid-mlb-stats — MLB Stats MCP Server
 *
 * Major League Baseball data — teams, rosters, and schedules.
 *
 * Methods:
 *   get_teams()                   — List MLB teams  (1¢)
 *   get_schedule(date)            — Get game schedule for a date  (1¢)
 *   get_standings(league_id)      — Get MLB standings by league  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTeamsInput {

}

interface GetScheduleInput {
  date: string
}

interface GetStandingsInput {
  league_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://statsapi.mlb.com/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-mlb-stats/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MLB Stats API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mlb-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_teams: { costCents: 1, displayName: 'Get Teams' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
      get_standings: { costCents: 1, displayName: 'Get Standings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTeams = sg.wrap(async (args: GetTeamsInput) => {

  const data = await apiFetch<any>(`/teams?sportId=1`)
  const items = (data.teams ?? []).slice(0, 30)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        abbreviation: item.abbreviation,
        league: item.league,
        division: item.division,
        venue: item.venue,
    })),
  }
}, { method: 'get_teams' })

const getSchedule = sg.wrap(async (args: GetScheduleInput) => {
  if (!args.date || typeof args.date !== 'string') throw new Error('date is required')
  const date = args.date.trim()
  const data = await apiFetch<any>(`/schedule?sportId=1&date=${encodeURIComponent(date)}`)
  const items = (data.dates ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        games: item.games,
    })),
  }
}, { method: 'get_schedule' })

const getStandings = sg.wrap(async (args: GetStandingsInput) => {
  if (!args.league_id || typeof args.league_id !== 'string') throw new Error('league_id is required')
  const league_id = args.league_id.trim()
  const data = await apiFetch<any>(`/standings?leagueId=${encodeURIComponent(league_id)}`)
  const items = (data.records ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        standingsType: item.standingsType,
        teamRecords: item.teamRecords,
    })),
  }
}, { method: 'get_standings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTeams, getSchedule, getStandings }

console.log('settlegrid-mlb-stats MCP server ready')
console.log('Methods: get_teams, get_schedule, get_standings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
