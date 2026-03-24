/**
 * settlegrid-unit-converter — Unit Conversion MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   convert(value, from, to)   — Convert between units             (1¢)
 *   list_units(category)       — List available units by category   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConvertInput {
  value: number
  from: string
  to: string
}

interface ListUnitsInput {
  category?: string
}

type UnitDef = { category: string; toBase: (v: number) => number; fromBase: (v: number) => number }

// ─── Unit Definitions ───────────────────────────────────────────────────────

const UNITS: Record<string, UnitDef> = {
  // Length (base: meters)
  m: { category: 'length', toBase: (v) => v, fromBase: (v) => v },
  km: { category: 'length', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  cm: { category: 'length', toBase: (v) => v * 0.01, fromBase: (v) => v / 0.01 },
  mm: { category: 'length', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
  mi: { category: 'length', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  yd: { category: 'length', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
  ft: { category: 'length', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  in: { category: 'length', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
  nm: { category: 'length', toBase: (v) => v * 1852, fromBase: (v) => v / 1852 },
  // Weight (base: grams)
  g: { category: 'weight', toBase: (v) => v, fromBase: (v) => v },
  kg: { category: 'weight', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  mg: { category: 'weight', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
  lb: { category: 'weight', toBase: (v) => v * 453.592, fromBase: (v) => v / 453.592 },
  oz: { category: 'weight', toBase: (v) => v * 28.3495, fromBase: (v) => v / 28.3495 },
  ton: { category: 'weight', toBase: (v) => v * 907185, fromBase: (v) => v / 907185 },
  tonne: { category: 'weight', toBase: (v) => v * 1000000, fromBase: (v) => v / 1000000 },
  // Temperature (base: celsius)
  celsius: { category: 'temperature', toBase: (v) => v, fromBase: (v) => v },
  fahrenheit: { category: 'temperature', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
  kelvin: { category: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  // Volume (base: liters)
  l: { category: 'volume', toBase: (v) => v, fromBase: (v) => v },
  ml: { category: 'volume', toBase: (v) => v * 0.001, fromBase: (v) => v / 0.001 },
  gal: { category: 'volume', toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  qt: { category: 'volume', toBase: (v) => v * 0.946353, fromBase: (v) => v / 0.946353 },
  cup: { category: 'volume', toBase: (v) => v * 0.236588, fromBase: (v) => v / 0.236588 },
  floz: { category: 'volume', toBase: (v) => v * 0.0295735, fromBase: (v) => v / 0.0295735 },
  // Speed (base: m/s)
  'km/h': { category: 'speed', toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
  mph: { category: 'speed', toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
  'm/s': { category: 'speed', toBase: (v) => v, fromBase: (v) => v },
  knot: { category: 'speed', toBase: (v) => v * 0.514444, fromBase: (v) => v / 0.514444 },
  // Data (base: bytes)
  B: { category: 'data', toBase: (v) => v, fromBase: (v) => v },
  KB: { category: 'data', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
  MB: { category: 'data', toBase: (v) => v * 1048576, fromBase: (v) => v / 1048576 },
  GB: { category: 'data', toBase: (v) => v * 1073741824, fromBase: (v) => v / 1073741824 },
  TB: { category: 'data', toBase: (v) => v * 1099511627776, fromBase: (v) => v / 1099511627776 },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unit-converter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert: { costCents: 1, displayName: 'Convert Units' },
      list_units: { costCents: 1, displayName: 'List Units' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convert = sg.wrap(async (args: ConvertInput) => {
  if (typeof args.value !== 'number' || isNaN(args.value)) throw new Error('value must be a number')
  if (!args.from || typeof args.from !== 'string') throw new Error('from unit is required')
  if (!args.to || typeof args.to !== 'string') throw new Error('to unit is required')

  const fromUnit = UNITS[args.from]
  const toUnit = UNITS[args.to]
  if (!fromUnit) throw new Error(`Unknown unit: "${args.from}". Use list_units to see available units.`)
  if (!toUnit) throw new Error(`Unknown unit: "${args.to}". Use list_units to see available units.`)
  if (fromUnit.category !== toUnit.category) {
    throw new Error(`Cannot convert between ${fromUnit.category} (${args.from}) and ${toUnit.category} (${args.to})`)
  }

  const baseValue = fromUnit.toBase(args.value)
  const result = toUnit.fromBase(baseValue)

  return {
    input: { value: args.value, unit: args.from },
    output: { value: Math.round(result * 1e10) / 1e10, unit: args.to },
    category: fromUnit.category,
  }
}, { method: 'convert' })

const listUnits = sg.wrap(async (args: ListUnitsInput) => {
  const category = args.category?.toLowerCase().trim() || null

  const categories: Record<string, string[]> = {}
  for (const [unit, def] of Object.entries(UNITS)) {
    if (category && def.category !== category) continue
    if (!categories[def.category]) categories[def.category] = []
    categories[def.category].push(unit)
  }

  if (category && !categories[category]) {
    throw new Error(`Unknown category: "${category}". Available: ${[...new Set(Object.values(UNITS).map((u) => u.category))].join(', ')}`)
  }

  return {
    categories: Object.entries(categories).map(([name, units]) => ({ category: name, units })),
    totalUnits: Object.keys(UNITS).length,
  }
}, { method: 'list_units' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convert, listUnits }

console.log('settlegrid-unit-converter MCP server ready')
console.log('Methods: convert, list_units')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
