/**
 * settlegrid-jse-south-africa — Johannesburg Stock Exchange MCP Server
 *
 * Provides index data, top stocks, and sector analysis for the Johannesburg Stock Exchange.
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

const INDICES: Record<string, { name: string; value: number; change_pct: number }> = { ftse_jse_top40: { name: 'FTSE/JSE Top 40', value: 72890.45, change_pct: 0.38 }, ftse_jse_allshare: { name: 'FTSE/JSE All Share', value: 80123.67, change_pct: 0.42 }, ftse_jse_fini15: { name: 'FTSE/JSE Fini 15', value: 18567.23, change_pct: 0.21 }, ftse_jse_resi10: { name: 'FTSE/JSE Resi 10', value: 62345.78, change_pct: 0.55 } }

const TOP_STOCKS: Array<{ symbol: string; name: string; market_cap_billion_zar: number; sector: string; pe_ratio: number; dividend_yield_pct: number }> = [{ symbol: 'NPN', name: 'Naspers', market_cap_billion_zar: 680, sector: 'Technology', pe_ratio: 24.5, dividend_yield_pct: 0.3 }, { symbol: 'CFR', name: 'Richemont', market_cap_billion_zar: 520, sector: 'Luxury', pe_ratio: 22.1, dividend_yield_pct: 1.8 }, { symbol: 'AGL', name: 'Anglo American', market_cap_billion_zar: 450, sector: 'Mining', pe_ratio: 8.3, dividend_yield_pct: 5.2 }, { symbol: 'SOL', name: 'Sasol', market_cap_billion_zar: 120, sector: 'Energy', pe_ratio: 6.1, dividend_yield_pct: 4.8 }, { symbol: 'SBK', name: 'Standard Bank', market_cap_billion_zar: 280, sector: 'Banking', pe_ratio: 9.2, dividend_yield_pct: 5.5 }]

const sg = settlegrid.init({
  toolSlug: 'jse-south-africa',
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
  return { exchange: 'Johannesburg Stock Exchange', ...idx, currency: 'ZAR', data_note: 'Reference data' }
}, { method: 'get_index' })

const getTopStocks = sg.wrap(async (args: GetTopStocksInput) => {
  const limit = Math.min(args.limit ?? 10, 20)
  let results = [...TOP_STOCKS]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: 'Johannesburg Stock Exchange', count: Math.min(results.length, limit), stocks: results.slice(0, limit), currency: 'ZAR' }
}, { method: 'get_top_stocks' })

const getMarketSummary = sg.wrap(async (_a: Record<string, never>) => {
  const sectors = new Set(TOP_STOCKS.map(s => s.sector))
  return {
    exchange: 'Johannesburg Stock Exchange',
    country: 'South Africa',
    currency: 'ZAR',
    indices: Object.entries(INDICES).map(([k, v]) => ({ key: k, ...v })),
    total_tracked_stocks: TOP_STOCKS.length,
    sectors: [...sectors],
    avg_pe: Math.round(TOP_STOCKS.reduce((s, t) => s + t.pe_ratio, 0) / TOP_STOCKS.length * 10) / 10,
    avg_dividend_yield: Math.round(TOP_STOCKS.reduce((s, t) => s + t.dividend_yield_pct, 0) / TOP_STOCKS.length * 10) / 10,
  }
}, { method: 'get_market_summary' })

export { getIndex, getTopStocks, getMarketSummary }
console.log('settlegrid-jse-south-africa MCP server ready')
console.log('Methods: get_index, get_top_stocks, get_market_summary')
console.log('Pricing: 2c per call | Powered by SettleGrid')
