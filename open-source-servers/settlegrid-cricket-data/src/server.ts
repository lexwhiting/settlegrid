/**
 * settlegrid-cricket-data — Cricket Data MCP Server
 *
 * Wraps TheSportsDB cricket endpoints with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_cricket_team(name) — search cricket teams (1¢)
 *   get_cricket_events(league_id) — upcoming cricket events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface EventInput { league_id: string }

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
  toolSlug: 'cricket-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_cricket_team: { costCents: 1, displayName: 'Search Cricket Team' },
      get_cricket_events: { costCents: 1, displayName: 'Cricket Events' },
    },
  },
})

const searchCricketTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('team name required')
  const data = await apiFetch<any>(`/searchteams.php?t=${encodeURIComponent(args.name)}`)
  const cricketTeams = (data.teams || []).filter((t: any) => t.strSport === 'Cricket')
  return {
    teams: cricketTeams.map((t: any) => ({
      id: t.idTeam, name: t.strTeam, country: t.strCountry,
      league: t.strLeague, stadium: t.strStadium, badge: t.strBadge,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_cricket_team' })

const getCricketEvents = sg.wrap(async (args: EventInput) => {
  if (!args.league_id) throw new Error('league_id required')
  const data = await apiFetch<any>(`/eventsnextleague.php?id=${args.league_id}`)
  return {
    events: (data.events || []).map((e: any) => ({
      id: e.idEvent, name: e.strEvent, date: e.dateEvent, time: e.strTime,
      home: e.strHomeTeam, away: e.strAwayTeam, venue: e.strVenue,
      season: e.strSeason, round: e.intRound,
    })),
  }
}, { method: 'get_cricket_events' })

export { searchCricketTeam, getCricketEvents }

console.log('settlegrid-cricket-data MCP server ready')
console.log('Methods: search_cricket_team, get_cricket_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
