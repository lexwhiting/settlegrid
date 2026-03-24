/**
 * settlegrid-cycling-data — Cycling Data MCP Server
 *
 * Wraps TheSportsDB cycling data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_cycling_team(name) — search teams (1¢)
 *   get_cycling_events(league_id) — cycling events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface EventInput { league_id: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'cycling-data',
  pricing: { defaultCostCents: 1, methods: { search_cycling_team: { costCents: 1, displayName: 'Search Cycling Team' }, get_cycling_events: { costCents: 1, displayName: 'Cycling Events' } } },
})

const searchCyclingTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/searchteams.php?t=${encodeURIComponent(args.name)}`)
  const cycling = (data.teams || []).filter((t: any) => t.strSport === 'Cycling')
  return { teams: cycling.map((t: any) => ({ id: t.idTeam, name: t.strTeam, country: t.strCountry, badge: t.strBadge, description: t.strDescriptionEN?.slice(0, 300) })) }
}, { method: 'search_cycling_team' })

const getCyclingEvents = sg.wrap(async (args: EventInput) => {
  if (!args.league_id) throw new Error('league_id is required')
  const data = await apiFetch<any>(`/eventsnextleague.php?id=${args.league_id}`)
  return { events: (data.events || []).map((e: any) => ({ id: e.idEvent, name: e.strEvent, date: e.dateEvent, venue: e.strVenue, season: e.strSeason })) }
}, { method: 'get_cycling_events' })

export { searchCyclingTeam, getCyclingEvents }

console.log('settlegrid-cycling-data MCP server ready')
console.log('Methods: search_cycling_team, get_cycling_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
