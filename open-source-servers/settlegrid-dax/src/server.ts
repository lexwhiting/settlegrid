/**
 * settlegrid-dax — DAX 40 MCP Server
 *
 * DAX 40 German blue-chip stock index constituent data. No API key needed.
 *
 * Methods:
 *   get_dax_info() — Index overview and stats (1¢)
 *   get_dax_constituents(sector?) — List constituents (1¢)
 *   search_dax(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'DAX 40',
  region: 'Germany',
  currency: 'EUR',
  constituents: 40,
  description: 'DAX 40 German blue-chip stock index constituent data',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "SAP", name: "SAP SE", sector: "Technology", weight: 11.5 },
  { ticker: "SIE", name: "Siemens AG", sector: "Industrials", weight: 8.2 },
  { ticker: "AIR", name: "Airbus SE", sector: "Industrials", weight: 6.8 },
  { ticker: "ALV", name: "Allianz SE", sector: "Financials", weight: 6.1 },
  { ticker: "DTE", name: "Deutsche Telekom AG", sector: "Communication Services", weight: 5.5 },
  { ticker: "MBG", name: "Mercedes-Benz Group AG", sector: "Automobiles", weight: 3.8 },
  { ticker: "MUV2", name: "Munich Re", sector: "Financials", weight: 3.5 },
  { ticker: "BMW", name: "BMW AG", sector: "Automobiles", weight: 3.2 },
  { ticker: "BAS", name: "BASF SE", sector: "Chemicals", weight: 2.8 },
  { ticker: "IFX", name: "Infineon Technologies", sector: "Technology", weight: 2.7 },
  { ticker: "BAYN", name: "Bayer AG", sector: "Health Care", weight: 2.4 },
  { ticker: "ADS", name: "Adidas AG", sector: "Consumer Discretionary", weight: 2.3 },
  { ticker: "DPW", name: "Deutsche Post AG", sector: "Industrials", weight: 2.1 },
  { ticker: "VOW3", name: "Volkswagen AG", sector: "Automobiles", weight: 1.9 },
  { ticker: "HEN3", name: "Henkel AG", sector: "Consumer Staples", weight: 1.5 },
  { ticker: "DB1", name: "Deutsche Boerse AG", sector: "Financials", weight: 1.8 },
  { ticker: "RWE", name: "RWE AG", sector: "Utilities", weight: 1.4 },
  { ticker: "FRE", name: "Fresenius SE", sector: "Health Care", weight: 1.2 },
  { ticker: "CON", name: "Continental AG", sector: "Automobiles", weight: 1.0 },
  { ticker: "HEI", name: "HeidelbergCement AG", sector: "Materials", weight: 0.9 },
]

const sg = settlegrid.init({
  toolSlug: 'dax',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dax_info: { costCents: 1, displayName: 'DAX 40 Info' },
      get_dax_constituents: { costCents: 1, displayName: 'DAX 40 Constituents' },
      search_dax: { costCents: 0, displayName: 'Search DAX 40' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_dax_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_dax_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_dax' })

export { getInfo, getConstituents, search }

console.log('settlegrid-dax MCP server ready')
console.log('Methods: get_dax_info, get_dax_constituents, search_dax')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
