/**
 * settlegrid-mma-data — MMA Fighter Data MCP Server
 *
 * Wraps TheSportsDB MMA data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_mma_fighter(name) — search MMA fighters (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FighterInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mma-data',
  pricing: { defaultCostCents: 1, methods: { search_mma_fighter: { costCents: 1, displayName: 'Search MMA Fighter' } } },
})

const searchMmaFighter = sg.wrap(async (args: FighterInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/searchplayers.php?p=${encodeURIComponent(args.name)}`)
  const mma = (data.player || []).filter((p: any) => p.strSport === 'Fighting' || p.strSport === 'MMA')
  return {
    fighters: mma.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      team: p.strTeam, born: p.dateBorn, height: p.strHeight,
      weight: p.strWeight, description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_mma_fighter' })

export { searchMmaFighter }

console.log('settlegrid-mma-data MCP server ready')
console.log('Methods: search_mma_fighter')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
