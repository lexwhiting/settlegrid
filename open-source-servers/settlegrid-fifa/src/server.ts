/**
 * settlegrid-fifa — FIFA Rankings & Data MCP Server
 *
 * Methods:
 *   get_world_cup_standings()                 — WC standings       (2¢)
 *   get_competition_teams(competition)        — Competition teams  (2¢)
 *   get_competition_matches(competition)      — Competition matches(2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompInput { competition: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || ''

async function fifaFetch<T>(path: string): Promise<T> {
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

const VALID_COMPS = new Set(['WC', 'EC', 'CLI', 'CL', 'BSA'])

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fifa',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_world_cup_standings: { costCents: 2, displayName: 'World Cup Standings' },
      get_competition_teams: { costCents: 2, displayName: 'Competition Teams' },
      get_competition_matches: { costCents: 2, displayName: 'Competition Matches' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getWorldCupStandings = sg.wrap(async () => {
  const data = await fifaFetch<{ competition: { name: string }; standings: Array<{ group: string; table: Array<{ position: number; team: { name: string; crest: string }; playedGames: number; won: number; draw: number; lost: number; points: number; goalsFor: number; goalsAgainst: number }> }> }>('/competitions/WC/standings')
  return {
    competition: data.competition?.name,
    groups: (data.standings || []).map((g) => ({
      group: g.group,
      table: g.table?.map((t) => ({
        position: t.position,
        team: t.team?.name,
        played: t.playedGames,
        won: t.won,
        drawn: t.draw,
        lost: t.lost,
        points: t.points,
        gf: t.goalsFor,
        ga: t.goalsAgainst,
      })),
    })),
  }
}, { method: 'get_world_cup_standings' })

const getCompetitionTeams = sg.wrap(async (args: CompInput) => {
  if (!args.competition) throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  if (!VALID_COMPS.has(code)) throw new Error(`Valid competitions: ${[...VALID_COMPS].join(', ')}`)
  const data = await fifaFetch<{ competition: { name: string }; teams: Array<{ id: number; name: string; shortName: string; crest: string; venue: string }> }>(`/competitions/${code}/teams`)
  return {
    competition: data.competition?.name,
    count: data.teams?.length || 0,
    teams: (data.teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      crest: t.crest,
      venue: t.venue,
    })),
  }
}, { method: 'get_competition_teams' })

const getCompetitionMatches = sg.wrap(async (args: CompInput) => {
  if (!args.competition) throw new Error('competition code is required')
  const code = args.competition.toUpperCase().trim()
  const data = await fifaFetch<{ matches: Array<{ id: number; utcDate: string; status: string; matchday: number; stage: string; homeTeam: { name: string }; awayTeam: { name: string }; score: { fullTime: { home: number | null; away: number | null } } }> }>(`/competitions/${code}/matches`)
  return {
    competition: code,
    count: data.matches?.length || 0,
    matches: (data.matches || []).slice(0, 20).map((m) => ({
      id: m.id,
      date: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      stage: m.stage,
      homeTeam: m.homeTeam?.name,
      awayTeam: m.awayTeam?.name,
      homeScore: m.score?.fullTime?.home,
      awayScore: m.score?.fullTime?.away,
    })),
  }
}, { method: 'get_competition_matches' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getWorldCupStandings, getCompetitionTeams, getCompetitionMatches }

console.log('settlegrid-fifa MCP server ready')
console.log('Methods: get_world_cup_standings, get_competition_teams, get_competition_matches')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
