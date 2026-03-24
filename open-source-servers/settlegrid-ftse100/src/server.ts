/**
 * settlegrid-ftse100 — FTSE 100 MCP Server
 *
 * FTSE 100 UK blue-chip index constituent data. No API key needed.
 *
 * Methods:
 *   get_ftse100_info() — Index overview and stats (1¢)
 *   get_ftse100_constituents(sector?) — List constituents (1¢)
 *   search_ftse100(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'FTSE 100',
  region: 'UK',
  constituents: 100,
  description: 'FTSE 100 UK blue-chip index constituent data',
  currency: 'UK' === 'US' ? 'USD' : 'UK' === 'UK' ? 'GBP' : 'UK' === 'Japan' ? 'JPY' : 'UK' === 'Germany' ? 'EUR' : 'UK' === 'France' ? 'EUR' : 'UK' === 'Hong Kong' ? 'HKD' : 'UK' === 'Australia' ? 'AUD' : 'USD',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "AZN", name: "AstraZeneca plc", sector: "Health Care", weight: 9.2 },
  { ticker: "SHEL", name: "Shell plc", sector: "Energy", weight: 7.8 },
  { ticker: "HSBA", name: "HSBC Holdings plc", sector: "Financials", weight: 5.2 },
  { ticker: "ULVR", name: "Unilever plc", sector: "Consumer Staples", weight: 4.3 },
  { ticker: "BP", name: "BP plc", sector: "Energy", weight: 3.1 },
  { ticker: "GSK", name: "GSK plc", sector: "Health Care", weight: 2.9 },
  { ticker: "DGE", name: "Diageo plc", sector: "Consumer Staples", weight: 2.8 },
  { ticker: "RIO", name: "Rio Tinto plc", sector: "Materials", weight: 2.5 },
  { ticker: "BATS", name: "British American Tobacco", sector: "Consumer Staples", weight: 2.3 },
  { ticker: "REL", name: "RELX plc", sector: "Industrials", weight: 2.1 },
  { ticker: "LSEG", name: "London Stock Exchange Group", sector: "Financials", weight: 2.0 },
  { ticker: "AAL", name: "Anglo American plc", sector: "Materials", weight: 1.5 },
  { ticker: "GLEN", name: "Glencore plc", sector: "Materials", weight: 1.4 },
  { ticker: "LLOY", name: "Lloyds Banking Group", sector: "Financials", weight: 1.4 },
  { ticker: "BARC", name: "Barclays plc", sector: "Financials", weight: 1.3 },
  { ticker: "VOD", name: "Vodafone Group plc", sector: "Communication Services", weight: 1.1 },
  { ticker: "NWG", name: "NatWest Group plc", sector: "Financials", weight: 0.9 },
  { ticker: "RR", name: "Rolls-Royce Holdings", sector: "Industrials", weight: 0.9 },
  { ticker: "IMB", name: "Imperial Brands plc", sector: "Consumer Staples", weight: 0.7 },
  { ticker: "NG", name: "National Grid plc", sector: "Utilities", weight: 0.7 },
]

const sg = settlegrid.init({
  toolSlug: 'ftse100',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ftse100_info: { costCents: 1, displayName: 'FTSE 100 Info' },
      get_ftse100_constituents: { costCents: 1, displayName: 'FTSE 100 Constituents' },
      search_ftse100: { costCents: 0, displayName: 'Search FTSE 100' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_ftse100_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_ftse100_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_ftse100' })

export { getInfo, getConstituents, search }

console.log('settlegrid-ftse100 MCP server ready')
console.log('Methods: get_ftse100_info, get_ftse100_constituents, search_ftse100')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
