/**
 * settlegrid-tennis-data — Tennis Data MCP Server
 *
 * Wraps TheSportsDB tennis data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tennis_player(name) — search tennis players (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'tennis-data',
  pricing: { defaultCostCents: 1, methods: { search_tennis_player: { costCents: 1, displayName: 'Search Tennis Player' } } },
})

const searchTennisPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/searchplayers.php?p=${encodeURIComponent(args.name)}`)
  const tennis = (data.player || []).filter((p: any) => p.strSport === 'Tennis')
  return {
    players: tennis.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      team: p.strTeam, position: p.strPosition, born: p.dateBorn,
      height: p.strHeight, weight: p.strWeight,
      description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_tennis_player' })

export { searchTennisPlayer }

console.log('settlegrid-tennis-data MCP server ready')
console.log('Methods: search_tennis_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
