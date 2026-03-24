/**
 * settlegrid-russell2000 — Russell 2000 MCP Server
 *
 * Russell 2000 small-cap index data — top constituents by weight. No API key needed.
 *
 * Methods:
 *   get_russell2000_info() — Index overview and stats (1¢)
 *   get_russell2000_constituents(sector?) — List constituents (1¢)
 *   search_russell2000(query) — Search constituents by name/ticker (free)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InfoInput {}
interface ConstituentsInput { sector?: string }
interface SearchInput { query: string }

const INDEX_INFO = {
  name: 'Russell 2000',
  region: 'US',
  constituents: 2000,
  description: 'Russell 2000 small-cap index data — top constituents by weight',
  currency: 'US' === 'US' ? 'USD' : 'US' === 'UK' ? 'GBP' : 'US' === 'Japan' ? 'JPY' : 'US' === 'Germany' ? 'EUR' : 'US' === 'France' ? 'EUR' : 'US' === 'Hong Kong' ? 'HKD' : 'US' === 'Australia' ? 'AUD' : 'USD',
}

const CONSTITUENTS: Array<{ ticker: string; name: string; sector: string; weight?: number }> = [
  { ticker: "SMCI", name: "Super Micro Computer", sector: "Technology" },
  { ticker: "CELH", name: "Celsius Holdings", sector: "Consumer Staples" },
  { ticker: "CORT", name: "Corcept Therapeutics", sector: "Health Care" },
  { ticker: "FN", name: "Fabrinet", sector: "Technology" },
  { ticker: "CVLT", name: "CommVault Systems", sector: "Technology" },
  { ticker: "PIPR", name: "Piper Sandler", sector: "Financials" },
  { ticker: "IBKR", name: "Interactive Brokers", sector: "Financials" },
  { ticker: "ALKS", name: "Alkermes plc", sector: "Health Care" },
  { ticker: "CADE", name: "Cadence Bank", sector: "Financials" },
  { ticker: "BPMC", name: "Blueprint Medicines", sector: "Health Care" },
  { ticker: "SFBS", name: "ServisFirst Bancshares", sector: "Financials" },
  { ticker: "SFM", name: "Sprouts Farmers Market", sector: "Consumer Staples" },
  { ticker: "LNTH", name: "Lantheus Holdings", sector: "Health Care" },
  { ticker: "EXPO", name: "Exponent Inc.", sector: "Industrials" },
  { ticker: "BOOT", name: "Boot Barn Holdings", sector: "Consumer Discretionary" },
  { ticker: "CALM", name: "Cal-Maine Foods", sector: "Consumer Staples" },
  { ticker: "OGN", name: "Organon & Co.", sector: "Health Care" },
  { ticker: "ADMA", name: "ADMA Biologics", sector: "Health Care" },
  { ticker: "KTOS", name: "Kratos Defense", sector: "Industrials" },
  { ticker: "PRGS", name: "Progress Software", sector: "Technology" },
]

const sg = settlegrid.init({
  toolSlug: 'russell2000',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_russell2000_info: { costCents: 1, displayName: 'Russell 2000 Info' },
      get_russell2000_constituents: { costCents: 1, displayName: 'Russell 2000 Constituents' },
      search_russell2000: { costCents: 0, displayName: 'Search Russell 2000' },
    },
  },
})

const getInfo = sg.wrap(async (_args: InfoInput) => {
  const sectors = [...new Set(CONSTITUENTS.map(c => c.sector))]
  const sectorCounts = sectors.map(s => ({ sector: s, count: CONSTITUENTS.filter(c => c.sector === s).length }))
    .sort((a, b) => b.count - a.count)
  return { ...INDEX_INFO, sectorBreakdown: sectorCounts, totalConstituents: CONSTITUENTS.length }
}, { method: 'get_russell2000_info' })

const getConstituents = sg.wrap(async (args: ConstituentsInput) => {
  let results = CONSTITUENTS
  if (args.sector) {
    const s = args.sector.toLowerCase()
    results = results.filter(c => c.sector.toLowerCase().includes(s))
  }
  return { count: results.length, constituents: results }
}, { method: 'get_russell2000_constituents' })

const search = sg.wrap(async (args: SearchInput) => {
  const q = (args.query || '').toLowerCase().trim()
  if (!q) throw new Error('query required')
  const matches = CONSTITUENTS.filter(c =>
    c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20)
  return { query: q, count: matches.length, results: matches }
}, { method: 'search_russell2000' })

export { getInfo, getConstituents, search }

console.log('settlegrid-russell2000 MCP server ready')
console.log('Methods: get_russell2000_info, get_russell2000_constituents, search_russell2000')
console.log('Pricing: 0-1¢ per call | Powered by SettleGrid')
