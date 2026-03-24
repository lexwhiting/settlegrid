/**
 * settlegrid-rugby-data — Rugby Data MCP Server
 *
 * Wraps TheSportsDB rugby data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_rugby_team(name) — search rugby teams (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'rugby-data',
  pricing: { defaultCostCents: 1, methods: { search_rugby_team: { costCents: 1, displayName: 'Search Rugby Team' } } },
})

const searchRugbyTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/searchteams.php?t=${encodeURIComponent(args.name)}`)
  const rugby = (data.teams || []).filter((t: any) => t.strSport?.toLowerCase().includes('rugby'))
  return {
    teams: rugby.map((t: any) => ({
      id: t.idTeam, name: t.strTeam, country: t.strCountry,
      league: t.strLeague, stadium: t.strStadium, badge: t.strBadge,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_rugby_team' })

export { searchRugbyTeam }

console.log('settlegrid-rugby-data MCP server ready')
console.log('Methods: search_rugby_team')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
