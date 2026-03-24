/**
 * settlegrid-hang-seng — Hang Seng Index MCP Server
 *
 * Hang Seng Index Hong Kong stock market constituent data. No API key needed.
 *
 * Methods:
 *   get_hang_seng_info() — Index overview and stats (1¢)
 *   get_hang_seng_constituents(sector?) — List constituents (1¢)
 *   search_hang_seng(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'Hang Seng Index',
  region: 'Hong Kong',
  currency: 'HKD',
  constituents: 82,
  description: 'Hang Seng Index Hong Kong stock market constituent data',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "0700", name: "Tencent Holdings Ltd.", sector: "Technology", weight: 9.8 },
  { ticker: "0941", name: "China Mobile Ltd.", sector: "Communication Services", weight: 5.2 },
  { ticker: "9988", name: "Alibaba Group Holdings", sector: "Consumer Discretionary", weight: 4.5 },
  { ticker: "1299", name: "AIA Group Ltd.", sector: "Financials", weight: 4.2 },
  { ticker: "0005", name: "HSBC Holdings plc", sector: "Financials", weight: 7.5 },
  { ticker: "0388", name: "Hong Kong Exchanges", sector: "Financials", weight: 3.8 },
  { ticker: "3690", name: "Meituan", sector: "Consumer Discretionary", weight: 3.5 },
  { ticker: "0939", name: "China Construction Bank", sector: "Financials", weight: 3.2 },
  { ticker: "1398", name: "ICBC", sector: "Financials", weight: 2.8 },
  { ticker: "2318", name: "Ping An Insurance", sector: "Financials", weight: 2.5 },
  { ticker: "0883", name: "CNOOC Ltd.", sector: "Energy", weight: 2.2 },
  { ticker: "0002", name: "CLP Holdings Ltd.", sector: "Utilities", weight: 1.8 },
  { ticker: "0003", name: "HK & China Gas", sector: "Utilities", weight: 1.5 },
  { ticker: "0016", name: "Sun Hung Kai Properties", sector: "Real Estate", weight: 1.4 },
  { ticker: "0027", name: "Galaxy Entertainment", sector: "Consumer Discretionary", weight: 1.2 },
  { ticker: "1810", name: "Xiaomi Corp.", sector: "Technology", weight: 2.0 },
  { ticker: "9618", name: "JD.com Inc.", sector: "Consumer Discretionary", weight: 1.8 },
  { ticker: "9999", name: "NetEase Inc.", sector: "Technology", weight: 1.5 },
  { ticker: "0011", name: "Hang Seng Bank Ltd.", sector: "Financials", weight: 1.0 },
  { ticker: "1038", name: "CK Infrastructure", sector: "Utilities", weight: 0.8 },
]

const sg = settlegrid.init({
  toolSlug: 'hang-seng',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hang_seng_info: { costCents: 1, displayName: 'Hang Seng Index Info' },
      get_hang_seng_constituents: { costCents: 1, displayName: 'Hang Seng Index Constituents' },
      search_hang_seng: { costCents: 0, displayName: 'Search Hang Seng Index' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_hang_seng_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_hang_seng_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_hang_seng' })

export { getInfo, getConstituents, search }

console.log('settlegrid-hang-seng MCP server ready')
console.log('Methods: get_hang_seng_info, get_hang_seng_constituents, search_hang_seng')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
