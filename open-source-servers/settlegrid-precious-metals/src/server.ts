/**
 * settlegrid-precious-metals — Precious Metals Data MCP Server
 *
 * Precious Metals Data tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const METALS: Record<string, { price_usd_oz: number; change_pct: number; ytd_pct: number; all_time_high: number; primary_use: string }> = {
  gold: { price_usd_oz: 2340, change_pct: 0.4, ytd_pct: 12.8, all_time_high: 2431, primary_use: 'Investment, jewelry, electronics' },
  silver: { price_usd_oz: 28.50, change_pct: 0.8, ytd_pct: 18.2, all_time_high: 49.51, primary_use: 'Industrial, solar panels, jewelry' },
  platinum: { price_usd_oz: 980, change_pct: -0.3, ytd_pct: -2.1, all_time_high: 2308, primary_use: 'Catalytic converters, jewelry' },
  palladium: { price_usd_oz: 1050, change_pct: -0.5, ytd_pct: -15.4, all_time_high: 3440, primary_use: 'Catalytic converters, electronics' },
  rhodium: { price_usd_oz: 4850, change_pct: 0.2, ytd_pct: -8.3, all_time_high: 29800, primary_use: 'Catalytic converters' },
}

const sg = settlegrid.init({ toolSlug: 'precious-metals', pricing: { defaultCostCents: 2, methods: {
  get_price: { costCents: 2, displayName: 'Get Metal Price' },
  list_metals: { costCents: 2, displayName: 'List All Metals' },
  convert_weight: { costCents: 1, displayName: 'Convert Weight' },
}}})

const getPrice = sg.wrap(async (args: { metal: string; unit?: string }) => {
  if (!args.metal) throw new Error('metal required')
  const m = METALS[args.metal.toLowerCase()]
  if (!m) throw new Error(`Unknown metal. Available: ${Object.keys(METALS).join(', ')}`)
  const multipliers: Record<string, number> = { oz: 1, gram: 1/31.1035, kg: 1000/31.1035 }
  const unit = (args.unit ?? 'oz').toLowerCase()
  const mult = multipliers[unit] ?? 1
  return { metal: args.metal, price: Math.round(m.price_usd_oz * mult * 100) / 100, unit: `USD/${unit}`, ...m, data_note: 'Reference price' }
}, { method: 'get_price' })

const listMetals = sg.wrap(async (_a: Record<string, never>) => {
  return { metals: Object.entries(METALS).map(([name, data]) => ({ name, ...data })), count: Object.keys(METALS).length }
}, { method: 'list_metals' })

const convertWeight = sg.wrap(async (args: { value: number; from: string; to: string }) => {
  if (!Number.isFinite(args.value)) throw new Error('value required')
  const factors: Record<string, number> = { oz: 31.1035, gram: 1, kg: 1000, lb: 453.592, tola: 11.664, tael: 37.429 }
  const f = factors[args.from.toLowerCase()]; const t = factors[args.to.toLowerCase()]
  if (!f || !t) throw new Error(`Unknown unit. Available: ${Object.keys(factors).join(', ')}`)
  return { value: args.value, from: args.from, to: args.to, result: Math.round(args.value * f / t * 10000) / 10000 }
}, { method: 'convert_weight' })

export { getPrice, listMetals, convertWeight }
console.log('settlegrid-precious-metals MCP server ready | Powered by SettleGrid')
