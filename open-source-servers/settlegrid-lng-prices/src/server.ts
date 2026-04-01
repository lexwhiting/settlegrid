/**
 * settlegrid-lng-prices — LNG Market Data MCP Server
 *
 * Provides liquefied natural gas pricing, trade routes, and terminal data.
 * Reference data based on global LNG market information.
 *
 * Methods:
 *   get_price(market)             — Get LNG spot price              (2c)
 *   list_terminals(country?)      — List LNG terminals              (2c)
 *   get_trade_routes()            — Major LNG trade routes          (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetPriceInput { market: string }
interface ListTerminalsInput { country?: string }

const MARKETS: Record<string, { price_usd_mmbtu: number; change_pct: number; benchmark: string }> = {
  jkm: { price_usd_mmbtu: 14.20, change_pct: 2.1, benchmark: 'Japan Korea Marker (Platts)' },
  nbp: { price_usd_mmbtu: 11.80, change_pct: -1.5, benchmark: 'National Balancing Point (UK)' },
  ttf: { price_usd_mmbtu: 12.50, change_pct: 0.8, benchmark: 'Title Transfer Facility (Netherlands)' },
  henry_hub: { price_usd_mmbtu: 2.80, change_pct: -3.2, benchmark: 'Henry Hub (US)' },
  aeco: { price_usd_mmbtu: 2.10, change_pct: -1.8, benchmark: 'AECO (Canada)' },
}

const TERMINALS = [
  { name: 'Sabine Pass', country: 'US', type: 'export', capacity_mtpa: 30, operator: 'Cheniere Energy' },
  { name: 'Freeport LNG', country: 'US', type: 'export', capacity_mtpa: 15, operator: 'Freeport LNG' },
  { name: 'Ras Laffan', country: 'Qatar', type: 'export', capacity_mtpa: 77, operator: 'QatarEnergy' },
  { name: 'Gorgon', country: 'Australia', type: 'export', capacity_mtpa: 15.6, operator: 'Chevron' },
  { name: 'Sakhalin', country: 'Russia', type: 'export', capacity_mtpa: 10.8, operator: 'Sakhalin Energy' },
  { name: 'South Hook', country: 'UK', type: 'import', capacity_mtpa: 21.5, operator: 'Qatar Petroleum' },
  { name: 'Gate Terminal', country: 'Netherlands', type: 'import', capacity_mtpa: 12, operator: 'Gasunie/Vopak' },
  { name: 'Incheon', country: 'South Korea', type: 'import', capacity_mtpa: 40, operator: 'KOGAS' },
]

const TRADE_ROUTES = [
  { from: 'Qatar', to: 'Japan/Korea', volume_mtpa: 45, transit_days: 18 },
  { from: 'Australia', to: 'Japan/China', volume_mtpa: 55, transit_days: 10 },
  { from: 'US Gulf', to: 'Europe', volume_mtpa: 35, transit_days: 12 },
  { from: 'US Gulf', to: 'Asia', volume_mtpa: 20, transit_days: 25 },
  { from: 'Russia', to: 'Europe', volume_mtpa: 15, transit_days: 5 },
]

const sg = settlegrid.init({
  toolSlug: 'lng-prices',
  pricing: { defaultCostCents: 2, methods: {
    get_price: { costCents: 2, displayName: 'Get LNG Price' },
    list_terminals: { costCents: 2, displayName: 'List Terminals' },
    get_trade_routes: { costCents: 2, displayName: 'Get Trade Routes' },
  }},
})

const getPrice = sg.wrap(async (args: GetPriceInput) => {
  if (!args.market) throw new Error('market required')
  const m = MARKETS[args.market.toLowerCase().replace(/ /g, '_')]
  if (!m) throw new Error(`Unknown market. Available: ${Object.keys(MARKETS).join(', ')}`)
  return { market: args.market, ...m, data_note: 'Reference price' }
}, { method: 'get_price' })

const listTerminals = sg.wrap(async (args: ListTerminalsInput) => {
  let results = [...TERMINALS]
  if (args.country) results = results.filter(t => t.country.toLowerCase().includes(args.country!.toLowerCase()))
  return { count: results.length, terminals: results, global_capacity_mtpa: TERMINALS.reduce((s, t) => s + t.capacity_mtpa, 0) }
}, { method: 'list_terminals' })

const getTradeRoutes = sg.wrap(async (_a: Record<string, never>) => {
  return { routes: TRADE_ROUTES, count: TRADE_ROUTES.length, total_volume_mtpa: TRADE_ROUTES.reduce((s, r) => s + r.volume_mtpa, 0) }
}, { method: 'get_trade_routes' })

export { getPrice, listTerminals, getTradeRoutes }
console.log('settlegrid-lng-prices MCP server ready')
console.log('Pricing: 2c per call | Powered by SettleGrid')
