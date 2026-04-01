/**
 * settlegrid-b3-brazil — B3 Brazilian Stock Exchange MCP Server
 *
 * Provides B3 stock exchange index data, top stocks, and sector analysis.
 * Reference data with enriched Brazilian market information.
 *
 * Methods:
 *   get_index(index)              — Get B3 index value              (2¢)
 *   get_top_stocks(sector?)       — Get top B3 stocks               (2¢)
 *   get_sector_overview()         — Get sector breakdown            (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndexInput {
  index: string
}

interface GetTopStocksInput {
  sector?: string
  limit?: number
}

interface IndexData {
  name: string
  value: number
  change_pct: number
  components: number
  description: string
}

interface StockData {
  symbol: string
  name: string
  market_cap_billion_brl: number
  sector: string
  pe_ratio: number
  dividend_yield_pct: number
}

// ─── Data ───────────────────────────────────────────────────────────────────

const INDICES: Record<string, IndexData> = {
  ibovespa: { name: 'Ibovespa', value: 128106.10, change_pct: 0.56, components: 86, description: 'Main benchmark index of B3' },
  ibrx50: { name: 'IBrX-50', value: 20134.45, change_pct: 0.48, components: 50, description: 'Top 50 most traded stocks' },
  ibrx100: { name: 'IBrX-100', value: 52870.33, change_pct: 0.52, components: 100, description: 'Top 100 most traded stocks' },
  smll: { name: 'Small Cap (SMLL)', value: 2198.76, change_pct: 0.72, components: 88, description: 'Small-cap stocks index' },
  idiv: { name: 'Dividend (IDIV)', value: 7234.12, change_pct: 0.31, components: 41, description: 'Highest dividend yield stocks' },
  ifix: { name: 'Real Estate (IFIX)', value: 3178.44, change_pct: 0.18, components: 108, description: 'Real estate investment trusts' },
  icon: { name: 'Consumer (ICON)', value: 4521.88, change_pct: 0.44, components: 32, description: 'Consumer sector index' },
}

const TOP_STOCKS: StockData[] = [
  { symbol: 'PETR4', name: 'Petrobras PN', market_cap_billion_brl: 530, sector: 'Oil & Gas', pe_ratio: 4.2, dividend_yield_pct: 18.5 },
  { symbol: 'VALE3', name: 'Vale ON', market_cap_billion_brl: 280, sector: 'Mining', pe_ratio: 6.8, dividend_yield_pct: 9.2 },
  { symbol: 'ITUB4', name: 'Itau Unibanco PN', market_cap_billion_brl: 310, sector: 'Banking', pe_ratio: 8.5, dividend_yield_pct: 4.8 },
  { symbol: 'BBDC4', name: 'Bradesco PN', market_cap_billion_brl: 160, sector: 'Banking', pe_ratio: 10.2, dividend_yield_pct: 5.1 },
  { symbol: 'WEGE3', name: 'WEG ON', market_cap_billion_brl: 190, sector: 'Industrials', pe_ratio: 35.4, dividend_yield_pct: 1.2 },
  { symbol: 'BBAS3', name: 'Banco do Brasil ON', market_cap_billion_brl: 145, sector: 'Banking', pe_ratio: 5.1, dividend_yield_pct: 8.9 },
  { symbol: 'ABEV3', name: 'Ambev ON', market_cap_billion_brl: 180, sector: 'Consumer', pe_ratio: 14.7, dividend_yield_pct: 5.3 },
  { symbol: 'RENT3', name: 'Localiza ON', market_cap_billion_brl: 65, sector: 'Transportation', pe_ratio: 20.1, dividend_yield_pct: 1.8 },
  { symbol: 'SUZB3', name: 'Suzano ON', market_cap_billion_brl: 72, sector: 'Pulp & Paper', pe_ratio: 7.3, dividend_yield_pct: 3.2 },
  { symbol: 'ELET3', name: 'Eletrobras ON', market_cap_billion_brl: 95, sector: 'Utilities', pe_ratio: 11.5, dividend_yield_pct: 4.5 },
]

const SECTORS: Record<string, { weight_pct: number; stocks: number; ytd_return_pct: number }> = {
  'Oil & Gas': { weight_pct: 18.2, stocks: 5, ytd_return_pct: 12.4 },
  'Banking': { weight_pct: 22.5, stocks: 8, ytd_return_pct: 8.7 },
  'Mining': { weight_pct: 12.1, stocks: 3, ytd_return_pct: -2.3 },
  'Industrials': { weight_pct: 8.4, stocks: 7, ytd_return_pct: 15.8 },
  'Consumer': { weight_pct: 10.3, stocks: 12, ytd_return_pct: 5.2 },
  'Utilities': { weight_pct: 9.8, stocks: 10, ytd_return_pct: 3.1 },
  'Transportation': { weight_pct: 4.2, stocks: 4, ytd_return_pct: 9.6 },
  'Pulp & Paper': { weight_pct: 3.8, stocks: 3, ytd_return_pct: 7.4 },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'b3-brazil',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_index: { costCents: 2, displayName: 'Get B3 Index' },
      get_top_stocks: { costCents: 2, displayName: 'Get Top Stocks' },
      get_sector_overview: { costCents: 2, displayName: 'Get Sector Overview' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndex = sg.wrap(async (args: GetIndexInput) => {
  if (!args.index || typeof args.index !== 'string') {
    throw new Error('index is required (e.g. "ibovespa", "smll", "idiv")')
  }
  const key = args.index.toLowerCase()
  const idx = INDICES[key]
  if (!idx) {
    throw new Error(`Unknown index "${args.index}". Available: ${Object.keys(INDICES).join(', ')}`)
  }
  return { exchange: 'B3 (Brasil Bolsa Balcao)', ...idx, data_note: 'Reference data — not real-time' }
}, { method: 'get_index' })

const getTopStocks = sg.wrap(async (args: GetTopStocksInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  let results = [...TOP_STOCKS]
  if (args.sector) {
    results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  }
  return {
    exchange: 'B3 Brazil',
    count: Math.min(results.length, limit),
    stocks: results.slice(0, limit),
    currency: 'BRL',
  }
}, { method: 'get_top_stocks' })

const getSectorOverview = sg.wrap(async (_args: Record<string, never>) => {
  const sectors = Object.entries(SECTORS).map(([name, data]) => ({ name, ...data }))
  return {
    exchange: 'B3 Brazil',
    sectors,
    total_sectors: sectors.length,
    market_cap_total_billion_brl: TOP_STOCKS.reduce((s, t) => s + t.market_cap_billion_brl, 0),
  }
}, { method: 'get_sector_overview' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndex, getTopStocks, getSectorOverview }

console.log('settlegrid-b3-brazil MCP server ready')
console.log('Methods: get_index, get_top_stocks, get_sector_overview')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
