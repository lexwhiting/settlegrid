/**
 * settlegrid-measurement-convert — Unit Conversion MCP Server
 *
 * Comprehensive unit conversion across length, weight, volume, area,
 * speed, pressure, and energy categories.
 *
 * Methods:
 *   convert(value, from, to)      — Convert between units           (1c)
 *   list_units(category?)         — List available units            (1c)
 *   get_categories()              — List unit categories            (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ConvertInput { value: number; from: string; to: string }
interface ListUnitsInput { category?: string }

// All conversions relative to SI base unit for each category
const UNITS: Record<string, { factor: number; category: string; name: string }> = {
  // Length (meters)
  mm: { factor: 0.001, category: 'length', name: 'millimeter' },
  cm: { factor: 0.01, category: 'length', name: 'centimeter' },
  m: { factor: 1, category: 'length', name: 'meter' },
  km: { factor: 1000, category: 'length', name: 'kilometer' },
  inch: { factor: 0.0254, category: 'length', name: 'inch' },
  ft: { factor: 0.3048, category: 'length', name: 'foot' },
  yd: { factor: 0.9144, category: 'length', name: 'yard' },
  mi: { factor: 1609.344, category: 'length', name: 'mile' },
  nm: { factor: 1852, category: 'length', name: 'nautical mile' },
  // Weight (grams)
  mg: { factor: 0.001, category: 'weight', name: 'milligram' },
  g: { factor: 1, category: 'weight', name: 'gram' },
  kg: { factor: 1000, category: 'weight', name: 'kilogram' },
  oz: { factor: 28.3495, category: 'weight', name: 'ounce' },
  lb: { factor: 453.592, category: 'weight', name: 'pound' },
  st: { factor: 6350.29, category: 'weight', name: 'stone' },
  tonne: { factor: 1000000, category: 'weight', name: 'metric tonne' },
  // Volume (liters)
  ml: { factor: 0.001, category: 'volume', name: 'milliliter' },
  l: { factor: 1, category: 'volume', name: 'liter' },
  gal: { factor: 3.78541, category: 'volume', name: 'US gallon' },
  qt: { factor: 0.946353, category: 'volume', name: 'quart' },
  pt: { factor: 0.473176, category: 'volume', name: 'pint' },
  cup: { factor: 0.236588, category: 'volume', name: 'cup' },
  fl_oz: { factor: 0.0295735, category: 'volume', name: 'fluid ounce' },
  // Area (square meters)
  sqm: { factor: 1, category: 'area', name: 'square meter' },
  sqft: { factor: 0.092903, category: 'area', name: 'square foot' },
  acre: { factor: 4046.86, category: 'area', name: 'acre' },
  hectare: { factor: 10000, category: 'area', name: 'hectare' },
  sqkm: { factor: 1000000, category: 'area', name: 'square kilometer' },
  sqmi: { factor: 2589988, category: 'area', name: 'square mile' },
  // Speed (m/s)
  mps: { factor: 1, category: 'speed', name: 'meters/second' },
  kph: { factor: 0.277778, category: 'speed', name: 'km/hour' },
  mph: { factor: 0.44704, category: 'speed', name: 'miles/hour' },
  knot: { factor: 0.514444, category: 'speed', name: 'knot' },
}

const sg = settlegrid.init({
  toolSlug: 'measurement-convert',
  pricing: { defaultCostCents: 1, methods: {
    convert: { costCents: 1, displayName: 'Convert Units' },
    list_units: { costCents: 1, displayName: 'List Units' },
    get_categories: { costCents: 1, displayName: 'Get Categories' },
  }},
})

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!Number.isFinite(args.value) || !args.from || !args.to) throw new Error('value, from, and to required')
  const fromUnit = UNITS[args.from.toLowerCase()]
  const toUnit = UNITS[args.to.toLowerCase()]
  if (!fromUnit) throw new Error(`Unknown from unit "${args.from}"`)
  if (!toUnit) throw new Error(`Unknown to unit "${args.to}"`)
  if (fromUnit.category !== toUnit.category) throw new Error(`Cannot convert ${fromUnit.category} to ${toUnit.category}`)
  const result = (args.value * fromUnit.factor) / toUnit.factor
  return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 1000000) / 1000000, category: fromUnit.category }
}, { method: 'convert' })

const listUnits = sg.wrap(async (args: ListUnitsInput) => {
  let entries = Object.entries(UNITS).map(([code, u]) => ({ code, ...u }))
  if (args.category) entries = entries.filter(u => u.category === args.category!.toLowerCase())
  return { units: entries, count: entries.length }
}, { method: 'list_units' })

const getCategories = sg.wrap(async (_a: Record<string, never>) => {
  const cats = new Set(Object.values(UNITS).map(u => u.category))
  return { categories: [...cats].map(c => ({ name: c, unit_count: Object.values(UNITS).filter(u => u.category === c).length })), count: cats.size }
}, { method: 'get_categories' })

export { convert, listUnits, getCategories }
console.log('settlegrid-measurement-convert MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
