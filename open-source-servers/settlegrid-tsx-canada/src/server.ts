/**
 * settlegrid-tsx-canada — Toronto Stock Exchange MCP Server
 *
 * Provides index data, top stocks, and sector analysis for the Toronto Stock Exchange.
 * Reference data with market context.
 *
 * Methods:
 *   get_index(index)              — Get index value                  (2c)
 *   get_top_stocks(sector?)       — Get top stocks                   (2c)
 *   get_market_summary()          — Get market overview              (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetIndexInput { index: string }
interface GetTopStocksInput { sector?: string; limit?: number }

const INDICES: Record<string, { name: string; value: number; change_pct: number }> = { composite: { name: 'S&P/TSX Composite', value: 22070.45, change_pct: 0.32 }, tsx60: { name: 'S&P/TSX 60', value: 1332.18, change_pct: 0.28 }, venture: { name: 'TSX Venture', value: 578.34, change_pct: 0.45 }, capped_energy: { name: 'Capped Energy', value: 232.67, change_pct: -0.11 } }

const TOP_STOCKS: Array<{ symbol: string; name: string; market_cap_billion_cad: number; sector: string; pe_ratio: number; dividend_yield_pct: number }> = [{ symbol: 'RY', name: 'Royal Bank of Canada', market_cap_billion_cad: 212, sector: 'Banking', pe_ratio: 12.5, dividend_yield_pct: 3.8 }, { symbol: 'TD', name: 'Toronto-Dominion Bank', market_cap_billion_cad: 155, sector: 'Banking', pe_ratio: 10.8, dividend_yield_pct: 4.2 }, { symbol: 'SHOP', name: 'Shopify', market_cap_billion_cad: 130, sector: 'Technology', pe_ratio: 65.4, dividend_yield_pct: 0 }, { symbol: 'ENB', name: 'Enbridge', market_cap_billion_cad: 102, sector: 'Energy', pe_ratio: 17.2, dividend_yield_pct: 6.8 }, { symbol: 'CNR', name: 'Canadian National Railway', market_cap_billion_cad: 98, sector: 'Transport', pe_ratio: 21.3, dividend_yield_pct: 1.9 }]

const sg = settlegrid.init({
  toolSlug: 'tsx-canada',
  pricing: { defaultCostCents: 2, methods: {
    get_index: { costCents: 2, displayName: 'Get Index' },
    get_top_stocks: { costCents: 2, displayName: 'Get Top Stocks' },
    get_market_summary: { costCents: 2, displayName: 'Get Market Summary' },
  }},
})

const getIndex = sg.wrap(async (args: GetIndexInput) => {
  if (!args.index) throw new Error('index is required')
  const key = args.index.toLowerCase().replace(/[- /]/g, '_')
  const idx = INDICES[key]
  if (!idx) throw new Error(`Unknown index. Available: ${Object.keys(INDICES).join(', ')}`)
  return { exchange: 'Toronto Stock Exchange', ...idx, currency: 'CAD', data_note: 'Reference data' }
}, { method: 'get_index' })

const getTopStocks = sg.wrap(async (args: GetTopStocksInput) => {
  const limit = Math.min(args.limit ?? 10, 20)
  let results = [...TOP_STOCKS]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: 'Toronto Stock Exchange', count: Math.min(results.length, limit), stocks: results.slice(0, limit), currency: 'CAD' }
}, { method: 'get_top_stocks' })

const getMarketSummary = sg.wrap(async (_a: Record<string, never>) => {
  const sectors = new Set(TOP_STOCKS.map(s => s.sector))
  return {
    exchange: 'Toronto Stock Exchange',
    country: 'Canada',
    currency: 'CAD',
    indices: Object.entries(INDICES).map(([k, v]) => ({ key: k, ...v })),
    total_tracked_stocks: TOP_STOCKS.length,
    sectors: [...sectors],
    avg_pe: Math.round(TOP_STOCKS.reduce((s, t) => s + t.pe_ratio, 0) / TOP_STOCKS.length * 10) / 10,
    avg_dividend_yield: Math.round(TOP_STOCKS.reduce((s, t) => s + t.dividend_yield_pct, 0) / TOP_STOCKS.length * 10) / 10,
  }
}, { method: 'get_market_summary' })

export { getIndex, getTopStocks, getMarketSummary }
console.log('settlegrid-tsx-canada MCP server ready')
console.log('Methods: get_index, get_top_stocks, get_market_summary')
console.log('Pricing: 2c per call | Powered by SettleGrid')
