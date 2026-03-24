/**
 * settlegrid-asx200 — ASX 200 MCP Server
 *
 * ASX 200 Australian stock market index constituent data. No API key needed.
 *
 * Methods:
 *   get_asx200_info() — Index overview and stats (1¢)
 *   get_asx200_constituents(sector?) — List constituents (1¢)
 *   search_asx200(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'ASX 200',
  region: 'Australia',
  currency: 'AUD',
  constituents: 200,
  description: 'ASX 200 Australian stock market index constituent data',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "BHP", name: "BHP Group Ltd.", sector: "Materials", weight: 10.5 },
  { ticker: "CBA", name: "Commonwealth Bank", sector: "Financials", weight: 8.2 },
  { ticker: "CSL", name: "CSL Ltd.", sector: "Health Care", weight: 6.8 },
  { ticker: "NAB", name: "National Australia Bank", sector: "Financials", weight: 4.5 },
  { ticker: "WBC", name: "Westpac Banking Corp.", sector: "Financials", weight: 4.0 },
  { ticker: "ANZ", name: "ANZ Group Holdings", sector: "Financials", weight: 3.8 },
  { ticker: "WDS", name: "Woodside Energy Group", sector: "Energy", weight: 3.5 },
  { ticker: "MQG", name: "Macquarie Group Ltd.", sector: "Financials", weight: 3.2 },
  { ticker: "FMG", name: "Fortescue Metals Group", sector: "Materials", weight: 2.8 },
  { ticker: "WES", name: "Wesfarmers Ltd.", sector: "Consumer Discretionary", weight: 2.5 },
  { ticker: "TLS", name: "Telstra Group Ltd.", sector: "Communication Services", weight: 2.2 },
  { ticker: "RIO", name: "Rio Tinto Ltd.", sector: "Materials", weight: 2.0 },
  { ticker: "WOW", name: "Woolworths Group Ltd.", sector: "Consumer Staples", weight: 1.8 },
  { ticker: "GMG", name: "Goodman Group", sector: "Real Estate", weight: 1.6 },
  { ticker: "TCL", name: "Transurban Group", sector: "Industrials", weight: 1.4 },
  { ticker: "ALL", name: "Aristocrat Leisure", sector: "Consumer Discretionary", weight: 1.2 },
  { ticker: "STO", name: "Santos Ltd.", sector: "Energy", weight: 1.1 },
  { ticker: "COL", name: "Coles Group Ltd.", sector: "Consumer Staples", weight: 0.9 },
  { ticker: "QBE", name: "QBE Insurance Group", sector: "Financials", weight: 0.8 },
  { ticker: "JHX", name: "James Hardie Industries", sector: "Materials", weight: 0.7 },
]

const sg = settlegrid.init({
  toolSlug: 'asx200',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_asx200_info: { costCents: 1, displayName: 'ASX 200 Info' },
      get_asx200_constituents: { costCents: 1, displayName: 'ASX 200 Constituents' },
      search_asx200: { costCents: 0, displayName: 'Search ASX 200' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_asx200_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_asx200_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_asx200' })

export { getInfo, getConstituents, search }

console.log('settlegrid-asx200 MCP server ready')
console.log('Methods: get_asx200_info, get_asx200_constituents, search_asx200')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
