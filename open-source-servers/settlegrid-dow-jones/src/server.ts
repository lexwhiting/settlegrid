/**
 * settlegrid-dow-jones — Dow Jones Industrial Average MCP Server
 *
 * DJIA 30 component data — price-weighted blue-chip index. No API key needed.
 *
 * Methods:
 *   get_dow_jones_info() — Index overview and stats (1¢)
 *   get_dow_jones_constituents(sector?) — List constituents (1¢)
 *   search_dow_jones(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'Dow Jones Industrial Average',
  region: 'US',
  constituents: 30,
  description: 'DJIA 30 component data — price-weighted blue-chip index',
  currency: 'US' === 'US' ? 'USD' : 'US' === 'UK' ? 'GBP' : 'US' === 'Japan' ? 'JPY' : 'US' === 'Germany' ? 'EUR' : 'US' === 'France' ? 'EUR' : 'US' === 'Hong Kong' ? 'HKD' : 'US' === 'Australia' ? 'AUD' : 'USD',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Health Care" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { ticker: "GS", name: "Goldman Sachs Group", sector: "Financials" },
  { ticker: "HD", name: "Home Depot Inc.", sector: "Consumer Discretionary" },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials" },
  { ticker: "AMGN", name: "Amgen Inc.", sector: "Health Care" },
  { ticker: "MCD", name: "McDonalds Corp.", sector: "Consumer Discretionary" },
  { ticker: "BA", name: "Boeing Co.", sector: "Industrials" },
  { ticker: "HON", name: "Honeywell International", sector: "Industrials" },
  { ticker: "AXP", name: "American Express Co.", sector: "Financials" },
  { ticker: "TRV", name: "Travelers Companies", sector: "Financials" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "IBM", name: "IBM Corp.", sector: "Technology" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care" },
  { ticker: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples" },
  { ticker: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { ticker: "MRK", name: "Merck & Co. Inc.", sector: "Health Care" },
  { ticker: "MMM", name: "3M Company", sector: "Industrials" },
  { ticker: "DIS", name: "Walt Disney Co.", sector: "Communication Services" },
  { ticker: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary" },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { ticker: "DOW", name: "Dow Inc.", sector: "Materials" },
  { ticker: "CSCO", name: "Cisco Systems", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corp.", sector: "Technology" },
  { ticker: "WBA", name: "Walgreens Boots Alliance", sector: "Consumer Staples" },
  { ticker: "VZ", name: "Verizon Communications", sector: "Communication Services" },
]

const sg = settlegrid.init({
  toolSlug: 'dow-jones',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dow_jones_info: { costCents: 1, displayName: 'Dow Jones Industrial Average Info' },
      get_dow_jones_constituents: { costCents: 1, displayName: 'Dow Jones Industrial Average Constituents' },
      search_dow_jones: { costCents: 0, displayName: 'Search Dow Jones Industrial Average' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_dow_jones_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_dow_jones_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_dow_jones' })

export { getInfo, getConstituents, search }

console.log('settlegrid-dow-jones MCP server ready')
console.log('Methods: get_dow_jones_info, get_dow_jones_constituents, search_dow_jones')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
