/**
 * settlegrid-golf-data — Golf Data MCP Server
 *
 * Wraps TheSportsDB golf data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_golf_player(name) — search golf players (1¢)
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
  toolSlug: 'golf-data',
  pricing: { defaultCostCents: 1, methods: { search_golf_player: { costCents: 1, displayName: 'Search Golf Player' } } },
})

const searchGolfPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/searchplayers.php?p=${encodeURIComponent(args.name)}`)
  const golf = (data.player || []).filter((p: any) => p.strSport === 'Golf')
  return {
    players: golf.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      born: p.dateBorn, height: p.strHeight, weight: p.strWeight,
      description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_golf_player' })

export { searchGolfPlayer }

console.log('settlegrid-golf-data MCP server ready')
console.log('Methods: search_golf_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
