/**
 * settlegrid-sse-shanghai — Shanghai Stock Exchange MCP Server
 *
 * Provides index data, top stocks, and sector analysis for the Shanghai Stock Exchange.
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

const INDICES: Record<string, { name: string; value: number; change_pct: number }> = { sse_composite: { name: 'SSE Composite', value: 3089.34, change_pct: 0.22 }, sse_50: { name: 'SSE 50', value: 2678.45, change_pct: 0.18 }, star_50: { name: 'STAR 50', value: 1023.67, change_pct: 0.45 }, csi_300: { name: 'CSI 300', value: 3745.89, change_pct: 0.31 } }

const TOP_STOCKS: Array<{ symbol: string; name: string; market_cap_billion_cny: number; sector: string; pe_ratio: number; dividend_yield_pct: number }> = [{ symbol: '601398', name: 'ICBC', market_cap_billion_cny: 1780, sector: 'Banking', pe_ratio: 4.8, dividend_yield_pct: 6.2 }, { symbol: '600519', name: 'Kweichow Moutai', market_cap_billion_cny: 2100, sector: 'Consumer', pe_ratio: 28.5, dividend_yield_pct: 1.9 }, { symbol: '601318', name: 'Ping An Insurance', market_cap_billion_cny: 720, sector: 'Insurance', pe_ratio: 6.5, dividend_yield_pct: 5.1 }, { symbol: '600036', name: 'China Merchants Bank', market_cap_billion_cny: 890, sector: 'Banking', pe_ratio: 5.2, dividend_yield_pct: 5.8 }, { symbol: '601899', name: 'Zijin Mining', market_cap_billion_cny: 380, sector: 'Mining', pe_ratio: 12.3, dividend_yield_pct: 2.4 }]

const sg = settlegrid.init({
  toolSlug: 'sse-shanghai',
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
  return { exchange: 'Shanghai Stock Exchange', ...idx, currency: 'CNY', data_note: 'Reference data' }
}, { method: 'get_index' })

const getTopStocks = sg.wrap(async (args: GetTopStocksInput) => {
  const limit = Math.min(args.limit ?? 10, 20)
  let results = [...TOP_STOCKS]
  if (args.sector) results = results.filter(s => s.sector.toLowerCase().includes(args.sector!.toLowerCase()))
  return { exchange: 'Shanghai Stock Exchange', count: Math.min(results.length, limit), stocks: results.slice(0, limit), currency: 'CNY' }
}, { method: 'get_top_stocks' })

const getMarketSummary = sg.wrap(async (_a: Record<string, never>) => {
  const sectors = new Set(TOP_STOCKS.map(s => s.sector))
  return {
    exchange: 'Shanghai Stock Exchange',
    country: 'China',
    currency: 'CNY',
    indices: Object.entries(INDICES).map(([k, v]) => ({ key: k, ...v })),
    total_tracked_stocks: TOP_STOCKS.length,
    sectors: [...sectors],
    avg_pe: Math.round(TOP_STOCKS.reduce((s, t) => s + t.pe_ratio, 0) / TOP_STOCKS.length * 10) / 10,
    avg_dividend_yield: Math.round(TOP_STOCKS.reduce((s, t) => s + t.dividend_yield_pct, 0) / TOP_STOCKS.length * 10) / 10,
  }
}, { method: 'get_market_summary' })

export { getIndex, getTopStocks, getMarketSummary }
console.log('settlegrid-sse-shanghai MCP server ready')
console.log('Methods: get_index, get_top_stocks, get_market_summary')
console.log('Pricing: 2c per call | Powered by SettleGrid')
