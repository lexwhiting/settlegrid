/**
 * settlegrid-sp500 — S&P 500 MCP Server
 *
 * S&P 500 index constituent data with sector breakdown. No API key needed.
 *
 * Methods:
 *   get_sp500_info() — Index overview and stats (1¢)
 *   get_sp500_constituents(sector?) — List constituents (1¢)
 *   search_sp500(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'S&P 500',
  region: 'US',
  constituents: 503,
  description: 'S&P 500 index constituent data with sector breakdown',
  currency: 'US' === 'US' ? 'USD' : 'US' === 'UK' ? 'GBP' : 'US' === 'Japan' ? 'JPY' : 'US' === 'Germany' ? 'EUR' : 'US' === 'France' ? 'EUR' : 'US' === 'Hong Kong' ? 'HKD' : 'US' === 'Australia' ? 'AUD' : 'USD',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", weight: 7.1 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", weight: 6.5 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", weight: 3.4 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", weight: 3.2 },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", sector: "Communication Services", weight: 2.1 },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Communication Services", weight: 1.9 },
  { ticker: "BRK.B", name: "Berkshire Hathaway Inc.", sector: "Financials", weight: 1.7 },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", weight: 1.6 },
  { ticker: "UNH", name: "UnitedHealth Group Inc.", sector: "Health Care", weight: 1.3 },
  { ticker: "LLY", name: "Eli Lilly and Co.", sector: "Health Care", weight: 1.3 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", weight: 1.2 },
  { ticker: "V", name: "Visa Inc.", sector: "Financials", weight: 1.1 },
  { ticker: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", weight: 1.1 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Health Care", weight: 1.0 },
  { ticker: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples", weight: 0.9 },
  { ticker: "MA", name: "Mastercard Inc.", sector: "Financials", weight: 0.9 },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology", weight: 0.9 },
  { ticker: "HD", name: "Home Depot Inc.", sector: "Consumer Discretionary", weight: 0.8 },
  { ticker: "COST", name: "Costco Wholesale Corp.", sector: "Consumer Staples", weight: 0.7 },
  { ticker: "MRK", name: "Merck & Co. Inc.", sector: "Health Care", weight: 0.7 },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Health Care", weight: 0.7 },
  { ticker: "CVX", name: "Chevron Corp.", sector: "Energy", weight: 0.7 },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology", weight: 0.6 },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples", weight: 0.6 },
  { ticker: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", weight: 0.6 },
  { ticker: "BAC", name: "Bank of America Corp.", sector: "Financials", weight: 0.6 },
  { ticker: "TMO", name: "Thermo Fisher Scientific", sector: "Health Care", weight: 0.5 },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Staples", weight: 0.5 },
  { ticker: "CSCO", name: "Cisco Systems Inc.", sector: "Technology", weight: 0.5 },
  { ticker: "ACN", name: "Accenture plc", sector: "Technology", weight: 0.5 },
]

const sg = settlegrid.init({
  toolSlug: 'sp500',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_sp500_info: { costCents: 1, displayName: 'S&P 500 Info' },
      get_sp500_constituents: { costCents: 1, displayName: 'S&P 500 Constituents' },
      search_sp500: { costCents: 0, displayName: 'Search S&P 500' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_sp500_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_sp500_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_sp500' })

export { getInfo, getConstituents, search }

console.log('settlegrid-sp500 MCP server ready')
console.log('Methods: get_sp500_info, get_sp500_constituents, search_sp500')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
