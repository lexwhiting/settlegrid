/**
 * settlegrid-thesportsdb — TheSportsDB MCP Server
 *
 * Methods:
 *   search_teams(query)             — Search teams       (1¢)
 *   search_players(query)           — Search players     (1¢)
 *   get_events(team_id, type?)      — Team events        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface EventsInput { team_id: string; type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function sdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TheSportsDB ${res.status}: ${body.slice(0, 200)}`)
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

const searchTeams = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await sdbFetch<{ teams: Array<{ idTeam: string; strTeam: string; strSport: string; strLeague: string; strCountry: string; strStadium: string; strDescriptionEN: string }> | null }>(`/searchteams.php?t=${q}`)
  return {
    query: args.query,
    teams: (data.teams || []).map((t) => ({
      id: t.idTeam,
      name: t.strTeam,
      sport: t.strSport,
      league: t.strLeague,
      country: t.strCountry,
      stadium: t.strStadium,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_teams' })

const searchPlayers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await sdbFetch<{ player: Array<{ idPlayer: string; strPlayer: string; strSport: string; strTeam: string; strNationality: string; strPosition: string; dateBorn: string }> | null }>(`/searchplayers.php?p=${q}`)
  return {
    query: args.query,
    players: (data.player || []).map((p) => ({
      id: p.idPlayer,
      name: p.strPlayer,
      sport: p.strSport,
      team: p.strTeam,
      nationality: p.strNationality,
      position: p.strPosition,
      born: p.dateBorn,
    })),
  }
}, { method: 'search_players' })

const getEvents = sg.wrap(async (args: EventsInput) => {
  if (!args.team_id || typeof args.team_id !== 'string') throw new Error('team_id is required')
  const endpoint = args.type === 'last' ? 'eventslast' : 'eventsnext'
  const data = await sdbFetch<{ results: Array<{ idEvent: string; strEvent: string; strLeague: string; dateEvent: string; strTime: string; strHomeTeam: string; strAwayTeam: string; intHomeScore: string; intAwayScore: string }> | null }>(`/${endpoint}.php?id=${args.team_id}`)
  return {
    teamId: args.team_id,
    type: args.type || 'next',
    events: (data.results || []).map((e) => ({
      id: e.idEvent,
      name: e.strEvent,
      league: e.strLeague,
      date: e.dateEvent,
      time: e.strTime,
      homeTeam: e.strHomeTeam,
      awayTeam: e.strAwayTeam,
      homeScore: e.intHomeScore,
      awayScore: e.intAwayScore,
    })),
  }
}, { method: 'get_events' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTeams, searchPlayers, getEvents }

console.log('settlegrid-thesportsdb MCP server ready')
console.log('Methods: search_teams, search_players, get_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
