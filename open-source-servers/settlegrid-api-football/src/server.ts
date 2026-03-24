/**
 * settlegrid-api-football — API-Football MCP Server
 *
 * Comprehensive football/soccer data — fixtures, standings, and statistics.
 *
 * Methods:
 *   get_leagues()                 — List available football leagues  (2¢)
 *   get_standings(league, season) — Get league standings by league and season  (2¢)
 *   get_fixtures(league, season)  — Get fixtures for a league and season  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLeaguesInput {

}

interface GetStandingsInput {
  league: number
  season: number
}

interface GetFixturesInput {
  league: number
  season: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-api-football/1.0', 'x-apisports-key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API-Football API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'api-football',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_leagues: { costCents: 2, displayName: 'Get Leagues' },
      get_standings: { costCents: 2, displayName: 'Get Standings' },
      get_fixtures: { costCents: 2, displayName: 'Get Fixtures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLeagues = sg.wrap(async (args: GetLeaguesInput) => {

  const data = await apiFetch<any>(`/leagues`)
  const items = (data.response ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        league: item.league,
        country: item.country,
        seasons: item.seasons,
    })),
  }
}, { method: 'get_leagues' })

const getStandings = sg.wrap(async (args: GetStandingsInput) => {
  if (typeof args.league !== 'number') throw new Error('league is required and must be a number')
  const league = args.league
  if (typeof args.season !== 'number') throw new Error('season is required and must be a number')
  const season = args.season
  const data = await apiFetch<any>(`/standings?league=${league}&season=${season}`)
  const items = (data.response ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        league: item.league,
        standings: item.standings,
    })),
  }
}, { method: 'get_standings' })

const getFixtures = sg.wrap(async (args: GetFixturesInput) => {
  if (typeof args.league !== 'number') throw new Error('league is required and must be a number')
  const league = args.league
  if (typeof args.season !== 'number') throw new Error('season is required and must be a number')
  const season = args.season
  const data = await apiFetch<any>(`/fixtures?league=${league}&season=${season}&last=10`)
  const items = (data.response ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        fixture: item.fixture,
        teams: item.teams,
        goals: item.goals,
        score: item.score,
    })),
  }
}, { method: 'get_fixtures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLeagues, getStandings, getFixtures }

console.log('settlegrid-api-football MCP server ready')
console.log('Methods: get_leagues, get_standings, get_fixtures')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
