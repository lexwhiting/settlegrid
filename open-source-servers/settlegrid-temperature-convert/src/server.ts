/**
 * settlegrid-temperature-convert — Temperature Converter MCP Server
 *
 * Temperature Converter tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface ConvertInput { value: number; from: string; to: string }

const sg = settlegrid.init({ toolSlug: 'temperature-convert', pricing: { defaultCostCents: 1, methods: {
  convert: { costCents: 1, displayName: 'Convert Temperature' },
  get_reference: { costCents: 1, displayName: 'Get Reference Points' },
  convert_all: { costCents: 1, displayName: 'Convert to All Units' },
}}})

function toCelsius(value: number, from: string): number {
  switch (from) { case 'c': return value; case 'f': return (value - 32) * 5 / 9; case 'k': return value - 273.15; case 'r': return (value - 491.67) * 5 / 9; default: throw new Error('from must be c, f, k, or r') }
}
function fromCelsius(c: number, to: string): number {
  switch (to) { case 'c': return c; case 'f': return c * 9 / 5 + 32; case 'k': return c + 273.15; case 'r': return (c + 273.15) * 9 / 5; default: throw new Error('to must be c, f, k, or r') }
}

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!Number.isFinite(args.value) || !args.from || !args.to) throw new Error('value, from, to required')
  const f = args.from.toLowerCase()[0]; const t = args.to.toLowerCase()[0]
  const celsius = toCelsius(args.value, f)
  const result = fromCelsius(celsius, t)
  return { value: args.value, from: args.from, to: args.to, result: Math.round(result * 100) / 100 }
}, { method: 'convert' })

const getReference = sg.wrap(async (_a: Record<string, never>) => ({
  references: [
    { name: 'Absolute zero', c: -273.15, f: -459.67, k: 0 },
    { name: 'Water freezes', c: 0, f: 32, k: 273.15 },
    { name: 'Room temperature', c: 22, f: 71.6, k: 295.15 },
    { name: 'Human body', c: 37, f: 98.6, k: 310.15 },
    { name: 'Water boils', c: 100, f: 212, k: 373.15 },
    { name: 'Oven baking', c: 180, f: 356, k: 453.15 },
  ]
}), { method: 'get_reference' })

const convertAll = sg.wrap(async (args: { value: number; from: string }) => {
  if (!Number.isFinite(args.value) || !args.from) throw new Error('value and from required')
  const c = toCelsius(args.value, args.from.toLowerCase()[0])
  return { input: args.value, from: args.from, celsius: Math.round(c * 100) / 100, fahrenheit: Math.round(fromCelsius(c, 'f') * 100) / 100, kelvin: Math.round(fromCelsius(c, 'k') * 100) / 100, rankine: Math.round(fromCelsius(c, 'r') * 100) / 100 }
}, { method: 'convert_all' })

export { convert, getReference, convertAll }
console.log('settlegrid-temperature-convert MCP server ready | Powered by SettleGrid')
