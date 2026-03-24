/**
 * settlegrid-nikkei225 — Nikkei 225 MCP Server
 *
 * Nikkei 225 Japanese stock index constituent data. No API key needed.
 *
 * Methods:
 *   get_nikkei225_info() — Index overview and stats (1¢)
 *   get_nikkei225_constituents(sector?) — List constituents (1¢)
 *   search_nikkei225(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'Nikkei 225',
  region: 'Japan',
  currency: 'JPY',
  constituents: 225,
  description: 'Nikkei 225 Japanese stock index constituent data',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "7203", name: "Toyota Motor Corp.", sector: "Automobiles" },
  { ticker: "6758", name: "Sony Group Corp.", sector: "Technology" },
  { ticker: "6861", name: "Keyence Corp.", sector: "Technology" },
  { ticker: "9984", name: "SoftBank Group Corp.", sector: "Technology" },
  { ticker: "8306", name: "Mitsubishi UFJ Financial", sector: "Financials" },
  { ticker: "6501", name: "Hitachi Ltd.", sector: "Technology" },
  { ticker: "7741", name: "HOYA Corp.", sector: "Health Care" },
  { ticker: "6902", name: "Denso Corp.", sector: "Automobiles" },
  { ticker: "6098", name: "Recruit Holdings", sector: "Services" },
  { ticker: "4063", name: "Shin-Etsu Chemical", sector: "Chemicals" },
  { ticker: "9432", name: "NTT Corp.", sector: "Communication Services" },
  { ticker: "4568", name: "Daiichi Sankyo Co.", sector: "Health Care" },
  { ticker: "8035", name: "Tokyo Electron Ltd.", sector: "Technology" },
  { ticker: "6367", name: "Daikin Industries", sector: "Industrials" },
  { ticker: "7267", name: "Honda Motor Co.", sector: "Automobiles" },
  { ticker: "6954", name: "FANUC Corp.", sector: "Industrials" },
  { ticker: "4502", name: "Takeda Pharmaceutical", sector: "Health Care" },
  { ticker: "4519", name: "Chugai Pharmaceutical", sector: "Health Care" },
  { ticker: "6594", name: "Nidec Corp.", sector: "Technology" },
  { ticker: "9433", name: "KDDI Corp.", sector: "Communication Services" },
]

const sg = settlegrid.init({
  toolSlug: 'nikkei225',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_nikkei225_info: { costCents: 1, displayName: 'Nikkei 225 Info' },
      get_nikkei225_constituents: { costCents: 1, displayName: 'Nikkei 225 Constituents' },
      search_nikkei225: { costCents: 0, displayName: 'Search Nikkei 225' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_nikkei225_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_nikkei225_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_nikkei225' })

export { getInfo, getConstituents, search }

console.log('settlegrid-nikkei225 MCP server ready')
console.log('Methods: get_nikkei225_info, get_nikkei225_constituents, search_nikkei225')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
