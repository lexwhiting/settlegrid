/**
 * settlegrid-carbon-credits — Carbon Credit Market Data MCP Server
 *
 * Provides carbon credit pricing across major compliance and voluntary
 * markets, with offset project type information.
 *
 * Methods:
 *   get_price(market)             — Get carbon price by market       (2¢)
 *   get_market_overview()         — Full market overview             (2¢)
 *   get_offset_types()            — Carbon offset project types      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPriceInput {
  market: string
}

interface MarketData {
  full_name: string
  price_usd_tonne: number
  change_pct: number
  volume_mt: number
  type: string
  launched: number
}

// ─── Data ───────────────────────────────────────────────────────────────────

const MARKETS: Record<string, MarketData> = {
  eu_ets: { full_name: 'EU Emissions Trading System', price_usd_tonne: 62.30, change_pct: -2.1, volume_mt: 1500, type: 'compliance', launched: 2005 },
  uk_ets: { full_name: 'UK Emissions Trading Scheme', price_usd_tonne: 48.50, change_pct: 0.8, volume_mt: 120, type: 'compliance', launched: 2021 },
  california: { full_name: 'California Cap-and-Trade', price_usd_tonne: 34.20, change_pct: 1.2, volume_mt: 350, type: 'compliance', launched: 2013 },
  rggi: { full_name: 'Regional Greenhouse Gas Initiative', price_usd_tonne: 13.90, change_pct: -0.5, volume_mt: 200, type: 'compliance', launched: 2009 },
  china: { full_name: 'China National ETS', price_usd_tonne: 9.80, change_pct: 3.4, volume_mt: 2000, type: 'compliance', launched: 2021 },
  south_korea: { full_name: 'Korea ETS', price_usd_tonne: 8.20, change_pct: 1.1, volume_mt: 600, type: 'compliance', launched: 2015 },
  new_zealand: { full_name: 'NZ Emissions Trading Scheme', price_usd_tonne: 32.40, change_pct: -4.2, volume_mt: 35, type: 'compliance', launched: 2008 },
  voluntary: { full_name: 'Voluntary Carbon Market (avg)', price_usd_tonne: 8.50, change_pct: -5.3, volume_mt: 250, type: 'voluntary', launched: 2005 },
}

const OFFSET_TYPES: Array<{ type: string; avg_price: number; permanence: string; co_benefits: string[] }> = [
  { type: 'Forestry / REDD+', avg_price: 12.50, permanence: 'medium (25-100yr)', co_benefits: ['biodiversity', 'community livelihoods'] },
  { type: 'Renewable Energy', avg_price: 3.20, permanence: 'high', co_benefits: ['air quality', 'energy access'] },
  { type: 'Improved Cookstoves', avg_price: 5.80, permanence: 'medium', co_benefits: ['health', 'gender equality'] },
  { type: 'Direct Air Capture', avg_price: 600.00, permanence: 'very high (1000yr+)', co_benefits: ['scalability'] },
  { type: 'Biochar', avg_price: 120.00, permanence: 'high (100yr+)', co_benefits: ['soil health', 'agriculture'] },
  { type: 'Ocean Alkalinity', avg_price: 200.00, permanence: 'very high', co_benefits: ['ocean health'] },
  { type: 'Methane Capture', avg_price: 8.40, permanence: 'high', co_benefits: ['air quality', 'energy recovery'] },
  { type: 'Soil Carbon', avg_price: 18.00, permanence: 'low-medium (10-30yr)', co_benefits: ['agriculture', 'water retention'] },
]

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'carbon-credits',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_price: { costCents: 2, displayName: 'Get Carbon Price' },
      get_market_overview: { costCents: 2, displayName: 'Get Market Overview' },
      get_offset_types: { costCents: 2, displayName: 'Get Offset Types' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: GetPriceInput) => {
  if (!args.market || typeof args.market !== 'string') {
    throw new Error('market is required (e.g. "eu_ets", "california", "voluntary")')
  }
  const key = args.market.toLowerCase().replace(/[- ]/g, '_')
  const m = MARKETS[key]
  if (!m) {
    throw new Error(`Unknown market "${args.market}". Available: ${Object.keys(MARKETS).join(', ')}`)
  }
  return { market: key, ...m, data_note: 'Reference prices — not real-time' }
}, { method: 'get_price' })

const getMarketOverview = sg.wrap(async (_args: Record<string, never>) => {
  const markets = Object.entries(MARKETS).map(([key, data]) => ({ key, ...data }))
  const totalVolume = markets.reduce((s, m) => s + m.volume_mt, 0)
  return {
    total_market_value_billion_usd: 909,
    global_emissions_gt: 37.4,
    total_traded_volume_mt: totalVolume,
    compliance_markets: markets.filter(m => m.type === 'compliance').length,
    markets,
  }
}, { method: 'get_market_overview' })

const getOffsetTypes = sg.wrap(async (_args: Record<string, never>) => {
  return {
    count: OFFSET_TYPES.length,
    offset_types: OFFSET_TYPES,
    price_range: {
      min: Math.min(...OFFSET_TYPES.map(o => o.avg_price)),
      max: Math.max(...OFFSET_TYPES.map(o => o.avg_price)),
    },
  }
}, { method: 'get_offset_types' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getMarketOverview, getOffsetTypes }

console.log('settlegrid-carbon-credits MCP server ready')
console.log('Methods: get_price, get_market_overview, get_offset_types')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
