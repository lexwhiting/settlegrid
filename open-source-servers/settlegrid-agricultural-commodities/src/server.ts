/**
 * settlegrid-agricultural-commodities — Agricultural Commodity Data MCP Server
 *
 * Provides agricultural commodity prices, production data, and market analysis.
 * Reference data with local enrichment.
 *
 * Methods:
 *   get_commodity(name)           — Get commodity price and details  (2¢)
 *   list_commodities()            — List all tracked commodities     (2¢)
 *   get_production(commodity)     — Top producers by commodity       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCommodityInput {
  name: string
}

interface GetProductionInput {
  commodity: string
  limit?: number
}

interface CommodityData {
  price: number
  unit: string
  change_pct: number
  top_producer: string
  global_production_mt: number
  season: string
  exchange: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const COMMODITIES: Record<string, CommodityData> = {
  wheat: { price: 5.82, unit: 'USD/bushel', change_pct: -2.1, top_producer: 'China', global_production_mt: 784, season: 'Sep-Jul', exchange: 'CBOT' },
  corn: { price: 4.38, unit: 'USD/bushel', change_pct: -1.5, top_producer: 'United States', global_production_mt: 1222, season: 'Mar-Nov', exchange: 'CBOT' },
  soybeans: { price: 11.84, unit: 'USD/bushel', change_pct: 0.8, top_producer: 'Brazil', global_production_mt: 370, season: 'May-Oct', exchange: 'CBOT' },
  rice: { price: 17.42, unit: 'USD/cwt', change_pct: 3.2, top_producer: 'China', global_production_mt: 520, season: 'Apr-Oct', exchange: 'CBOT' },
  coffee: { price: 1.89, unit: 'USD/lb', change_pct: 5.4, top_producer: 'Brazil', global_production_mt: 10.7, season: 'Year-round', exchange: 'ICE' },
  cocoa: { price: 5234, unit: 'USD/tonne', change_pct: 42.1, top_producer: 'Ivory Coast', global_production_mt: 4.8, season: 'Oct-Mar', exchange: 'ICE' },
  sugar: { price: 0.215, unit: 'USD/lb', change_pct: -3.8, top_producer: 'Brazil', global_production_mt: 180, season: 'Apr-Nov', exchange: 'ICE' },
  cotton: { price: 0.87, unit: 'USD/lb', change_pct: 1.2, top_producer: 'China', global_production_mt: 25, season: 'Apr-Oct', exchange: 'ICE' },
  palm_oil: { price: 856, unit: 'USD/tonne', change_pct: 2.7, top_producer: 'Indonesia', global_production_mt: 77, season: 'Year-round', exchange: 'BMD' },
  oats: { price: 3.55, unit: 'USD/bushel', change_pct: -0.9, top_producer: 'Russia', global_production_mt: 23, season: 'Apr-Aug', exchange: 'CBOT' },
  rubber: { price: 1520, unit: 'USD/tonne', change_pct: 1.8, top_producer: 'Thailand', global_production_mt: 14, season: 'Year-round', exchange: 'TOCOM' },
  canola: { price: 628, unit: 'CAD/tonne', change_pct: -1.1, top_producer: 'Canada', global_production_mt: 87, season: 'May-Oct', exchange: 'ICE Canada' },
}

const TOP_PRODUCERS: Record<string, Array<{ country: string; production_mt: number; share_pct: number }>> = {
  wheat: [
    { country: 'China', production_mt: 137, share_pct: 17.5 },
    { country: 'India', production_mt: 110, share_pct: 14.0 },
    { country: 'Russia', production_mt: 92, share_pct: 11.7 },
    { country: 'United States', production_mt: 47, share_pct: 6.0 },
    { country: 'France', production_mt: 36, share_pct: 4.6 },
  ],
  corn: [
    { country: 'United States', production_mt: 384, share_pct: 31.4 },
    { country: 'China', production_mt: 277, share_pct: 22.7 },
    { country: 'Brazil', production_mt: 130, share_pct: 10.6 },
    { country: 'Argentina', production_mt: 50, share_pct: 4.1 },
    { country: 'Ukraine', production_mt: 30, share_pct: 2.5 },
  ],
  soybeans: [
    { country: 'Brazil', production_mt: 154, share_pct: 41.6 },
    { country: 'United States', production_mt: 114, share_pct: 30.8 },
    { country: 'Argentina', production_mt: 44, share_pct: 11.9 },
    { country: 'China', production_mt: 20, share_pct: 5.4 },
    { country: 'India', production_mt: 12, share_pct: 3.2 },
  ],
  coffee: [
    { country: 'Brazil', production_mt: 3.7, share_pct: 34.6 },
    { country: 'Vietnam', production_mt: 1.85, share_pct: 17.3 },
    { country: 'Colombia', production_mt: 0.72, share_pct: 6.7 },
    { country: 'Indonesia', production_mt: 0.67, share_pct: 6.3 },
    { country: 'Ethiopia', production_mt: 0.5, share_pct: 4.7 },
  ],
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'agricultural-commodities',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_commodity: { costCents: 2, displayName: 'Get Commodity' },
      list_commodities: { costCents: 2, displayName: 'List Commodities' },
      get_production: { costCents: 2, displayName: 'Get Production Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCommodity = sg.wrap(async (args: GetCommodityInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (e.g. "wheat", "coffee", "soybeans")')
  }
  const key = args.name.toLowerCase().replace(/ /g, '_')
  const c = COMMODITIES[key]
  if (!c) {
    throw new Error(`Unknown commodity "${args.name}". Available: ${Object.keys(COMMODITIES).join(', ')}`)
  }
  return {
    commodity: key,
    price: c.price,
    unit: c.unit,
    change_pct: c.change_pct,
    direction: c.change_pct >= 0 ? 'up' : 'down',
    top_producer: c.top_producer,
    global_production_mt: c.global_production_mt,
    growing_season: c.season,
    exchange: c.exchange,
    data_note: 'Reference prices — not real-time',
  }
}, { method: 'get_commodity' })

const listCommodities = sg.wrap(async (_args: Record<string, never>) => {
  const items = Object.entries(COMMODITIES).map(([name, data]) => ({
    name,
    price: data.price,
    unit: data.unit,
    change_pct: data.change_pct,
    top_producer: data.top_producer,
  }))
  return {
    count: items.length,
    commodities: items,
    exchanges: ['CBOT', 'ICE', 'BMD', 'TOCOM', 'ICE Canada'],
  }
}, { method: 'list_commodities' })

const getProduction = sg.wrap(async (args: GetProductionInput) => {
  if (!args.commodity || typeof args.commodity !== 'string') {
    throw new Error('commodity is required (e.g. "wheat", "corn")')
  }
  const key = args.commodity.toLowerCase().replace(/ /g, '_')
  const producers = TOP_PRODUCERS[key]
  if (!producers) {
    throw new Error(`Production data unavailable for "${args.commodity}". Available: ${Object.keys(TOP_PRODUCERS).join(', ')}`)
  }
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  return {
    commodity: key,
    global_production_mt: COMMODITIES[key]?.global_production_mt ?? 0,
    top_producers: producers.slice(0, limit),
    count: Math.min(producers.length, limit),
  }
}, { method: 'get_production' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCommodity, listCommodities, getProduction }

console.log('settlegrid-agricultural-commodities MCP server ready')
console.log('Methods: get_commodity, list_commodities, get_production')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
