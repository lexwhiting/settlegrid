/**
 * settlegrid-football-data — Football-Data.org MCP Server
 *
 * Soccer data — leagues, standings, fixtures, and scorers.
 *
 * Methods:
 *   get_competitions()            — List available soccer competitions  (2¢)
 *   get_standings(competition)    — Get league standings by competition code  (2¢)
 *   get_matches(competition)      — Get matches for a competition  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCompetitionsInput {

}

interface GetStandingsInput {
  competition: string
}

interface GetMatchesInput {
  competition: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-football-data/1.0', 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Football-Data.org API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'football-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_competitions: { costCents: 2, displayName: 'Get Competitions' },
      get_standings: { costCents: 2, displayName: 'Get Standings' },
      get_matches: { costCents: 2, displayName: 'Get Matches' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCompetitions = sg.wrap(async (args: GetCompetitionsInput) => {

  const data = await apiFetch<any>(`/competitions`)
  const items = (data.competitions ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        area: item.area,
        currentSeason: item.currentSeason,
    })),
  }
}, { method: 'get_competitions' })

const getStandings = sg.wrap(async (args: GetStandingsInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition is required')
  const competition = args.competition.trim()
  const data = await apiFetch<any>(`/competitions/${encodeURIComponent(competition)}/standings`)
  const items = (data.standings ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        stage: item.stage,
        type: item.type,
        table: item.table,
    })),
  }
}, { method: 'get_standings' })

const getMatches = sg.wrap(async (args: GetMatchesInput) => {
  if (!args.competition || typeof args.competition !== 'string') throw new Error('competition is required')
  const competition = args.competition.trim()
  const data = await apiFetch<any>(`/competitions/${encodeURIComponent(competition)}/matches?limit=10`)
  const items = (data.matches ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        utcDate: item.utcDate,
        status: item.status,
        homeTeam: item.homeTeam,
        awayTeam: item.awayTeam,
        score: item.score,
    })),
  }
}, { method: 'get_matches' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCompetitions, getStandings, getMatches }

console.log('settlegrid-football-data MCP server ready')
console.log('Methods: get_competitions, get_standings, get_matches')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
