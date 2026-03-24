/**
 * settlegrid-esports — Esports MCP Server
 *
 * Esports match data, teams, and tournaments via PandaScore.
 *
 * Methods:
 *   list_matches(game)            — List upcoming or recent esports matches  (2¢)
 *   search_teams(query)           — Search esports teams by name  (2¢)
 *   list_tournaments(game)        — List current esports tournaments  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListMatchesInput {
  game?: string
}

interface SearchTeamsInput {
  query: string
}

interface ListTournamentsInput {
  game?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.pandascore.co'
const API_KEY = process.env.PANDASCORE_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-esports/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Esports API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'esports',
  pricing: {
    defaultCostCents: 2,
    methods: {
      list_matches: { costCents: 2, displayName: 'List Matches' },
      search_teams: { costCents: 2, displayName: 'Search Teams' },
      list_tournaments: { costCents: 2, displayName: 'List Tournaments' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listMatches = sg.wrap(async (args: ListMatchesInput) => {
  const game = typeof args.game === 'string' ? args.game.trim() : ''
  const data = await apiFetch<any>(`/matches/upcoming?per_page=10`)
  return {
    id: data.id,
    name: data.name,
    scheduled_at: data.scheduled_at,
    status: data.status,
    videogame: data.videogame,
  }
}, { method: 'list_matches' })

const searchTeams = sg.wrap(async (args: SearchTeamsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/teams?search[name]=${encodeURIComponent(query)}&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    acronym: data.acronym,
    slug: data.slug,
  }
}, { method: 'search_teams' })

const listTournaments = sg.wrap(async (args: ListTournamentsInput) => {
  const game = typeof args.game === 'string' ? args.game.trim() : ''
  const data = await apiFetch<any>(`/tournaments/running?per_page=10`)
  return {
    id: data.id,
    name: data.name,
    begin_at: data.begin_at,
    end_at: data.end_at,
    league: data.league,
  }
}, { method: 'list_tournaments' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listMatches, searchTeams, listTournaments }

console.log('settlegrid-esports MCP server ready')
console.log('Methods: list_matches, search_teams, list_tournaments')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
