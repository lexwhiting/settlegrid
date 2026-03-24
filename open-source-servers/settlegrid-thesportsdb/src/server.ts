/**
 * settlegrid-thesportsdb — TheSportsDB MCP Server
 *
 * Multi-sport data — teams, players, events across all major sports.
 *
 * Methods:
 *   search_teams(query)           — Search sports teams by name  (1¢)
 *   search_players(query)         — Search players by name  (1¢)
 *   get_events(league_id, round)  — Get past events for a league by round  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTeamsInput {
  query: string
}

interface SearchPlayersInput {
  query: string
}

interface GetEventsInput {
  league_id: string
  round: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-thesportsdb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TheSportsDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'thesportsdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_teams: { costCents: 1, displayName: 'Search Teams' },
      search_players: { costCents: 1, displayName: 'Search Players' },
      get_events: { costCents: 1, displayName: 'Get Events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTeams = sg.wrap(async (args: SearchTeamsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/searchteams.php?t=${encodeURIComponent(query)}`)
  const items = (data.teams ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idTeam: item.idTeam,
        strTeam: item.strTeam,
        strLeague: item.strLeague,
        strSport: item.strSport,
        strCountry: item.strCountry,
        strStadium: item.strStadium,
    })),
  }
}, { method: 'search_teams' })

const searchPlayers = sg.wrap(async (args: SearchPlayersInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/searchplayers.php?p=${encodeURIComponent(query)}`)
  const items = (data.player ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idPlayer: item.idPlayer,
        strPlayer: item.strPlayer,
        strTeam: item.strTeam,
        strNationality: item.strNationality,
        strPosition: item.strPosition,
        strSport: item.strSport,
    })),
  }
}, { method: 'search_players' })

const getEvents = sg.wrap(async (args: GetEventsInput) => {
  if (!args.league_id || typeof args.league_id !== 'string') throw new Error('league_id is required')
  const league_id = args.league_id.trim()
  if (!args.round || typeof args.round !== 'string') throw new Error('round is required')
  const round = args.round.trim()
  const data = await apiFetch<any>(`/eventsround.php?id=${encodeURIComponent(league_id)}&r=${encodeURIComponent(round)}`)
  const items = (data.events ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        idEvent: item.idEvent,
        strEvent: item.strEvent,
        strHomeTeam: item.strHomeTeam,
        strAwayTeam: item.strAwayTeam,
        intHomeScore: item.intHomeScore,
        intAwayScore: item.intAwayScore,
        dateEvent: item.dateEvent,
    })),
  }
}, { method: 'get_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTeams, searchPlayers, getEvents }

console.log('settlegrid-thesportsdb MCP server ready')
console.log('Methods: search_teams, search_players, get_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
