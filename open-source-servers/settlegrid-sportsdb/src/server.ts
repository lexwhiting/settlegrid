/**
 * settlegrid-sportsdb — TheSportsDB MCP Server
 *
 * Wraps TheSportsDB free API with SettleGrid billing.
 * No API key needed — uses free tier.
 *
 * Methods:
 *   search_team(name) — search teams (1¢)
 *   get_league_events(league_id) — league events (1¢)
 *   search_player(name) — search players (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface LeagueInput { league_id: string }
interface PlayerInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'sportsdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_team: { costCents: 1, displayName: 'Search Team' },
      get_league_events: { costCents: 1, displayName: 'League Events' },
      search_player: { costCents: 1, displayName: 'Search Player' },
    },
  },
})

const searchTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('team name required')
  const data = await apiFetch<any>(`/searchteams.php?t=${encodeURIComponent(args.name)}`)
  return {
    teams: (data.teams || []).map((t: any) => ({
      id: t.idTeam, name: t.strTeam, league: t.strLeague, sport: t.strSport,
      country: t.strCountry, stadium: t.strStadium, description: t.strDescriptionEN?.slice(0, 300),
      badge: t.strBadge, year_formed: t.intFormedYear,
    })),
  }
}, { method: 'search_team' })

const getLeagueEvents = sg.wrap(async (args: LeagueInput) => {
  if (!args.league_id) throw new Error('league_id required')
  const data = await apiFetch<any>(`/eventsnextleague.php?id=${args.league_id}`)
  return {
    events: (data.events || []).map((e: any) => ({
      id: e.idEvent, name: e.strEvent, date: e.dateEvent, time: e.strTime,
      home: e.strHomeTeam, away: e.strAwayTeam, venue: e.strVenue, league: e.strLeague,
    })),
  }
}, { method: 'get_league_events' })

const searchPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('player name required')
  const data = await apiFetch<any>(`/searchplayers.php?p=${encodeURIComponent(args.name)}`)
  return {
    players: (data.player || []).map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, team: p.strTeam, sport: p.strSport,
      nationality: p.strNationality, position: p.strPosition, born: p.dateBorn,
      description: p.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_player' })

export { searchTeam, getLeagueEvents, searchPlayer }

console.log('settlegrid-sportsdb MCP server ready')
console.log('Methods: search_team, get_league_events, search_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
