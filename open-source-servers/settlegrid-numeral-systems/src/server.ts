/**
 * settlegrid-numeral-systems — Numeral System Converter MCP Server
 *
 * Numeral System Converter tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface ConvertInput { value: string; from: number; to: number }
interface ExplainInput { value: string; base: number }

const sg = settlegrid.init({ toolSlug: 'numeral-systems', pricing: { defaultCostCents: 1, methods: {
  convert: { costCents: 1, displayName: 'Convert Base' },
  explain: { costCents: 1, displayName: 'Explain Number' },
  common_conversions: { costCents: 1, displayName: 'Common Conversions' },
}}})

const convert = sg.wrap(async (args: ConvertInput) => {
  if (!args.value || !Number.isFinite(args.from) || !Number.isFinite(args.to)) throw new Error('value, from (base), to (base) required')
  if (args.from < 2 || args.from > 36 || args.to < 2 || args.to > 36) throw new Error('Bases must be 2-36')
  const decimal = parseInt(args.value, args.from)
  if (isNaN(decimal)) throw new Error(`Invalid value "${args.value}" for base ${args.from}`)
  return { value: args.value, from_base: args.from, to_base: args.to, result: decimal.toString(args.to).toUpperCase(), decimal: decimal }
}, { method: 'convert' })

const explain = sg.wrap(async (args: ExplainInput) => {
  if (!args.value || !Number.isFinite(args.base)) throw new Error('value and base required')
  const decimal = parseInt(args.value, args.base)
  if (isNaN(decimal)) throw new Error('Invalid value for given base')
  return {
    value: args.value, base: args.base, decimal,
    binary: decimal.toString(2), octal: decimal.toString(8),
    hex: decimal.toString(16).toUpperCase(),
    digits: args.value.split('').map((d, i) => ({ digit: d, position: args.value.length - 1 - i, value: parseInt(d, args.base) * Math.pow(args.base, args.value.length - 1 - i) }))
  }
}, { method: 'explain' })

const commonConversions = sg.wrap(async (args: { decimal: number }) => {
  if (!Number.isFinite(args.decimal)) throw new Error('decimal number required')
  const n = args.decimal
  return { decimal: n, binary: n.toString(2), octal: n.toString(8), hex: n.toString(16).toUpperCase(), base36: n.toString(36).toUpperCase() }
}, { method: 'common_conversions' })

export { convert, explain, commonConversions }
console.log('settlegrid-numeral-systems MCP server ready | Powered by SettleGrid')
