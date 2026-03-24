/**
 * settlegrid-cac40 — CAC 40 MCP Server
 *
 * CAC 40 French blue-chip stock index constituent data. No API key needed.
 *
 * Methods:
 *   get_cac40_info() — Index overview and stats (1¢)
 *   get_cac40_constituents(sector?) — List constituents (1¢)
 *   search_cac40(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'CAC 40',
  region: 'France',
  currency: 'EUR',
  constituents: 40,
  description: 'CAC 40 French blue-chip stock index constituent data',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "MC", name: "LVMH Moet Hennessy", sector: "Consumer Discretionary", weight: 12.5 },
  { ticker: "OR", name: "LOreal SA", sector: "Consumer Staples", weight: 7.8 },
  { ticker: "TTE", name: "TotalEnergies SE", sector: "Energy", weight: 6.2 },
  { ticker: "SAN", name: "Sanofi SA", sector: "Health Care", weight: 5.1 },
  { ticker: "AI", name: "Air Liquide SA", sector: "Materials", weight: 4.8 },
  { ticker: "AIR", name: "Airbus SE", sector: "Industrials", weight: 4.5 },
  { ticker: "SU", name: "Schneider Electric SE", sector: "Industrials", weight: 4.2 },
  { ticker: "BN", name: "Danone SA", sector: "Consumer Staples", weight: 2.8 },
  { ticker: "EL", name: "EssilorLuxottica SA", sector: "Health Care", weight: 3.1 },
  { ticker: "BNP", name: "BNP Paribas SA", sector: "Financials", weight: 3.0 },
  { ticker: "KER", name: "Kering SA", sector: "Consumer Discretionary", weight: 2.5 },
  { ticker: "RI", name: "Pernod Ricard SA", sector: "Consumer Staples", weight: 2.2 },
  { ticker: "CS", name: "AXA SA", sector: "Financials", weight: 2.0 },
  { ticker: "DSY", name: "Dassault Systemes SE", sector: "Technology", weight: 1.9 },
  { ticker: "RMS", name: "Hermes International", sector: "Consumer Discretionary", weight: 3.5 },
  { ticker: "VIV", name: "Vivendi SE", sector: "Communication Services", weight: 1.2 },
  { ticker: "ORA", name: "Orange SA", sector: "Communication Services", weight: 1.0 },
  { ticker: "EN", name: "Bouygues SA", sector: "Industrials", weight: 0.8 },
  { ticker: "CAP", name: "Capgemini SE", sector: "Technology", weight: 1.5 },
  { ticker: "SGO", name: "Saint-Gobain SA", sector: "Materials", weight: 1.3 },
]

const sg = settlegrid.init({
  toolSlug: 'cac40',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cac40_info: { costCents: 1, displayName: 'CAC 40 Info' },
      get_cac40_constituents: { costCents: 1, displayName: 'CAC 40 Constituents' },
      search_cac40: { costCents: 0, displayName: 'Search CAC 40' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_cac40_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_cac40_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_cac40' })

export { getInfo, getConstituents, search }

console.log('settlegrid-cac40 MCP server ready')
console.log('Methods: get_cac40_info, get_cac40_constituents, search_cac40')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
