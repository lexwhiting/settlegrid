/**
 * settlegrid-football-data — Football-Data.org MCP Server
 *
 * Methods:
 *   get_standings(competition)             — League standings     (2¢)
 *   get_matches(competition, matchday?)    — Matches              (2¢)
 *   get_team(team_id)                      — Team details         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StandingsInput { competition: string }
interface MatchesInput { competition: string; matchday?: number }
interface TeamInput { team_id: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || ''

async function fdFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY environment variable is required')
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Football-Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const VALID_COMPETITIONS = new Set(['PL', 'BL1', 'SA', 'PD', 'FL1', 'ELC', 'DED', 'PPL', 'BSA', 'CL', 'EC', 'WC'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'football-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_standings: { costCents: 2, displayName: 'Get Standings' },
      get_matches: { costCents: 2, displayName: 'Get Matches' },
      get_team: { costCents: 2, displayName: 'Get Team' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStandings = sg.wrap(async (args: StandingsInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  if (!VALID_COMPETITIONS.has(code)) throw new Error(`Invalid competition. Valid: ${[...VALID_COMPETITIONS].join(', ')}`)
  const data = await fdFetch<{ competition: { name: string }; standings: Array<{ table: Array<{ position: number; team: { name: string; id: number }; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number; goalDifference: number }> }> }>(`/competitions/${code}/standings`)
  const table = data.standings?.[0]?.table || []
  return {
    competition: data.competition?.name,
    standings: table.map((t) => ({
      position: t.position,
      team: t.team.name,
      teamId: t.team.id,
      played: t.playedGames,
      won: t.won,
      drawn: t.draw,
      lost: t.lost,
      points: t.points,
      gf: t.goalsFor,
      ga: t.goalsAgainst,
      gd: t.goalDifference,
    })),
  }
}, { method: 'get_standings' })

const getMatches = sg.wrap(async (args: MatchesInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  const mdParam = args.matchday ? `?matchday=${args.matchday}` : ''
  const data = await fdFetch<{ matches: Array<{ id: number; utcDate: string; status: string; matchday: number; homeTeam: { name: string }; awayTeam: { name: string }; score: { fullTime: { home: number | null; away: number | null } } }> }>(`/competitions/${code}/matches${mdParam}`)
  return {
    competition: code,
    count: data.matches?.length || 0,
    matches: (data.matches || []).slice(0, 20).map((m) => ({
      id: m.id,
      date: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    })),
  }
}, { method: 'get_matches' })

const getTeam = sg.wrap(async (args: TeamInput) => {
  if (typeof args.team_id !== 'number' || args.team_id <= 0) throw new Error('team_id must be a positive number')
  const data = await fdFetch<{ id: number; name: string; shortName: string; crest: string; venue: string; founded: number; clubColors: string; squad: Array<{ id: number; name: string; position: string; nationality: string }> }>(`/teams/${args.team_id}`)
  return {
    id: data.id,
    name: data.name,
    shortName: data.shortName,
    crest: data.crest,
    venue: data.venue,
    founded: data.founded,
    colors: data.clubColors,
    squad: data.squad?.slice(0, 30).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      nationality: p.nationality,
    })),
  }
}, { method: 'get_team' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStandings, getMatches, getTeam }

console.log('settlegrid-football-data MCP server ready')
console.log('Methods: get_standings, get_matches, get_team')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
