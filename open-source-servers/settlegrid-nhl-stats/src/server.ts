/**
 * settlegrid-nhl-stats — NHL Stats MCP Server
 *
 * Methods:
 *   get_standings(date?)    — NHL standings      (1¢)
 *   get_schedule(date)      — Games by date      (1¢)
 *   get_roster(team)        — Team roster        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { date?: string }
interface ScheduleInput { date: string }
interface RosterInput { team: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api-web.nhle.com/v1'

async function nhlFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NHL API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nhl-stats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_standings: { costCents: 1, displayName: 'Get Standings' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
      get_roster: { costCents: 1, displayName: 'Get Roster' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  const dateParam = args.date ? `/${args.date}` : '/now'
  const data = await nhlFetch<{ standings: Array<{ teamAbbrev: { default: string }; teamName: { default: string }; conferenceName: string; divisionName: string; gamesPlayed: number; wins: number; losses: number; otLosses: number; points: number; goalFor: number; goalAgainst: number }> }>(`/standings${dateParam}`)
  return {
    count: data.standings?.length || 0,
    standings: (data.standings || []).map((t) => ({
      team: t.teamName?.default,
      abbrev: t.teamAbbrev?.default,
      conference: t.conferenceName,
      division: t.divisionName,
      gp: t.gamesPlayed,
      wins: t.wins,
      losses: t.losses,
      otl: t.otLosses,
      points: t.points,
      gf: t.goalFor,
      ga: t.goalAgainst,
    })),
  }
}, { method: 'get_standings' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  if (!args.date || !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error('date is required (YYYY-MM-DD)')
  const data = await nhlFetch<{ gameWeek: Array<{ date: string; games: Array<{ id: number; startTimeUTC: string; gameState: string; homeTeam: { abbrev: string; score: number }; awayTeam: { abbrev: string; score: number } }> }> }>(`/schedule/${args.date}`)
  const dayGames = data.gameWeek?.find((d) => d.date === args.date)
  return {
    date: args.date,
    games: (dayGames?.games || []).map((g) => ({
      id: g.id,
      startTime: g.startTimeUTC,
      state: g.gameState,
      home: g.homeTeam?.abbrev,
      away: g.awayTeam?.abbrev,
      homeScore: g.homeTeam?.score,
      awayScore: g.awayTeam?.score,
    })),
  }
}, { method: 'get_schedule' })

const getRoster = sg.wrap(async (args: RosterInput) => {
  if (!args.team || typeof args.team !== 'string') throw new Error('team abbreviation is required')
  const team = args.team.toUpperCase().trim()
  if (!/^[A-Z]{3}$/.test(team)) throw new Error('team must be a 3-letter abbreviation (e.g. "TOR")')
  const data = await nhlFetch<{ forwards: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }>; defensemen: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }>; goalies: Array<{ id: number; firstName: { default: string }; lastName: { default: string }; sweaterNumber: number; positionCode: string }> }>(`/roster/${team}/current`)
  const allPlayers = [...(data.forwards || []), ...(data.defensemen || []), ...(data.goalies || [])]
  return {
    team,
    count: allPlayers.length,
    players: allPlayers.map((p) => ({
      id: p.id,
      name: `${p.firstName?.default} ${p.lastName?.default}`,
      number: p.sweaterNumber,
      position: p.positionCode,
    })),
  }
}, { method: 'get_roster' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getSchedule, getRoster }

console.log('settlegrid-nhl-stats MCP server ready')
console.log('Methods: get_standings, get_schedule, get_roster')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
