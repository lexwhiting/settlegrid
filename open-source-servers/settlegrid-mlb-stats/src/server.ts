/**
 * settlegrid-mlb-stats — MLB Stats MCP Server
 *
 * Methods:
 *   get_standings(league_id?)  — MLB standings    (1¢)
 *   get_schedule(date)         — Games by date    (1¢)
 *   get_teams()                — List teams       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { league_id?: number }
interface ScheduleInput { date: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://statsapi.mlb.com/api/v1'

async function mlbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MLB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mlb-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_standings: { costCents: 1, displayName: 'Get Standings' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
      get_teams: { costCents: 1, displayName: 'Get Teams' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  const leagueParam = args.league_id ? `&leagueId=${args.league_id}` : ''
  const data = await mlbFetch<{ records: Array<{ division: { name: string }; teamRecords: Array<{ team: { name: string; id: number }; wins: number; losses: number; winningPercentage: string; gamesBack: string }> }> }>(`/standings?sportId=1${leagueParam}`)
  return {
    divisions: (data.records || []).map((d) => ({
      division: d.division?.name,
      teams: d.teamRecords?.map((t) => ({
        team: t.team.name,
        teamId: t.team.id,
        wins: t.wins,
        losses: t.losses,
        pct: t.winningPercentage,
        gb: t.gamesBack,
      })),
    })),
  }
}, { method: 'get_standings' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error('date is required (YYYY-MM-DD)')
  const data = await mlbFetch<{ dates: Array<{ date: string; games: Array<{ gamePk: number; gameDate: string; status: { detailedState: string }; teams: { home: { team: { name: string }; score: number }; away: { team: { name: string }; score: number } } }> }> }>(`/schedule?sportId=1&date=${args.date}`)
  const dateData = data.dates?.[0]
  return {
    date: args.date,
    games: (dateData?.games || []).map((g) => ({
      id: g.gamePk,
      status: g.status?.detailedState,
      homeTeam: g.teams.home.team.name,
      awayTeam: g.teams.away.team.name,
      homeScore: g.teams.home.score,
      awayScore: g.teams.away.score,
    })),
  }
}, { method: 'get_schedule' })

const getTeams = sg.wrap(async () => {
  const data = await mlbFetch<{ teams: Array<{ id: number; name: string; abbreviation: string; league: { name: string }; division: { name: string }; venue: { name: string } }> }>('/teams?sportId=1')
  return {
    count: data.teams?.length || 0,
    teams: (data.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      league: t.league?.name,
      division: t.division?.name,
      venue: t.venue?.name,
    })),
  }
}, { method: 'get_teams' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getSchedule, getTeams }

console.log('settlegrid-mlb-stats MCP server ready')
console.log('Methods: get_standings, get_schedule, get_teams')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
