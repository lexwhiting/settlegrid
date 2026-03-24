/**
 * settlegrid-nasdaq100 — NASDAQ 100 MCP Server
 *
 * NASDAQ 100 index constituent data focused on technology. No API key needed.
 *
 * Methods:
 *   get_nasdaq100_info() — Index overview and stats (1¢)
 *   get_nasdaq100_constituents(sector?) — List constituents (1¢)
 *   search_nasdaq100(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'NASDAQ 100',
  region: 'US',
  constituents: 101,
  description: 'NASDAQ 100 index constituent data focused on technology',
  currency: 'US' === 'US' ? 'USD' : 'US' === 'UK' ? 'GBP' : 'US' === 'Japan' ? 'JPY' : 'US' === 'Germany' ? 'EUR' : 'US' === 'France' ? 'EUR' : 'US' === 'Hong Kong' ? 'HKD' : 'US' === 'Australia' ? 'AUD' : 'USD',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", weight: 11.2 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", weight: 9.8 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", weight: 5.3 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", weight: 4.8 },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Communication Services", weight: 3.8 },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", sector: "Communication Services", weight: 3.1 },
  { ticker: "GOOG", name: "Alphabet Inc. Class C", sector: "Communication Services", weight: 3.0 },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", weight: 2.9 },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology", weight: 2.5 },
  { ticker: "COST", name: "Costco Wholesale Corp.", sector: "Consumer Staples", weight: 2.1 },
  { ticker: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", weight: 1.8 },
  { ticker: "CSCO", name: "Cisco Systems Inc.", sector: "Technology", weight: 1.6 },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Technology", weight: 1.5 },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology", weight: 1.4 },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Communication Services", weight: 1.3 },
  { ticker: "INTC", name: "Intel Corp.", sector: "Technology", weight: 1.2 },
  { ticker: "INTU", name: "Intuit Inc.", sector: "Technology", weight: 1.1 },
  { ticker: "CMCSA", name: "Comcast Corp.", sector: "Communication Services", weight: 1.0 },
  { ticker: "QCOM", name: "QUALCOMM Inc.", sector: "Technology", weight: 1.0 },
  { ticker: "AMGN", name: "Amgen Inc.", sector: "Health Care", weight: 0.9 },
  { ticker: "TMUS", name: "T-Mobile US Inc.", sector: "Communication Services", weight: 0.9 },
  { ticker: "HON", name: "Honeywell International", sector: "Industrials", weight: 0.8 },
  { ticker: "AMAT", name: "Applied Materials Inc.", sector: "Technology", weight: 0.8 },
  { ticker: "ISRG", name: "Intuitive Surgical Inc.", sector: "Health Care", weight: 0.7 },
  { ticker: "BKNG", name: "Booking Holdings Inc.", sector: "Consumer Discretionary", weight: 0.7 },
]

const sg = settlegrid.init({
  toolSlug: 'nasdaq100',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_nasdaq100_info: { costCents: 1, displayName: 'NASDAQ 100 Info' },
      get_nasdaq100_constituents: { costCents: 1, displayName: 'NASDAQ 100 Constituents' },
      search_nasdaq100: { costCents: 0, displayName: 'Search NASDAQ 100' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_nasdaq100_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_nasdaq100_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_nasdaq100' })

export { getInfo, getConstituents, search }

console.log('settlegrid-nasdaq100 MCP server ready')
console.log('Methods: get_nasdaq100_info, get_nasdaq100_constituents, search_nasdaq100')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
