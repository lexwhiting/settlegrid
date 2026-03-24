/**
 * settlegrid-api-football — API-Football MCP Server
 *
 * Methods:
 *   get_leagues(country?)          — List leagues      (2¢)
 *   get_fixtures(league, season)   — Get fixtures      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeaguesInput { country?: string }
interface FixturesInput { league: number; season: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY environment variable is required')
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API-Football ${res.status}: ${body.slice(0, 200)}`)
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
      get_fixtures: { costCents: 2, displayName: 'Get Fixtures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLeagues = sg.wrap(async (args: LeaguesInput) => {
  const countryParam = args.country ? `?country=${encodeURIComponent(args.country)}` : ''
  const data = await apiFetch<{ response: Array<{ league: { id: number; name: string; type: string; logo: string }; country: { name: string; flag: string }; seasons: Array<{ year: number; current: boolean }> }> }>(`/leagues${countryParam}`)
  return {
    count: data.response.length,
    leagues: data.response.slice(0, 20).map((l) => ({
      id: l.league.id,
      name: l.league.name,
      type: l.league.type,
      country: l.country.name,
      currentSeason: l.seasons?.find((s) => s.current)?.year,
    })),
  }
}, { method: 'get_leagues' })

const getFixtures = sg.wrap(async (args: FixturesInput) => {
  if (typeof args.league !== 'number' || args.league <= 0) throw new Error('league ID is required')
  if (typeof args.season !== 'number' || args.season < 2000) throw new Error('season year is required (e.g. 2024)')
  const data = await apiFetch<{ response: Array<{ fixture: { id: number; date: string; status: { short: string } }; teams: { home: { name: string }; away: { name: string } }; goals: { home: number | null; away: number | null } }> }>(`/fixtures?league=${args.league}&season=${args.season}`)
  return {
    league: args.league,
    season: args.season,
    count: data.response.length,
    fixtures: data.response.slice(0, 20).map((f) => ({
      id: f.fixture.id,
      date: f.fixture.date,
      status: f.fixture.status.short,
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
    })),
  }
}, { method: 'get_fixtures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLeagues, getFixtures }

console.log('settlegrid-api-football MCP server ready')
console.log('Methods: get_leagues, get_fixtures')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
