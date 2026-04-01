/**
 * settlegrid-roman-numerals — Roman Numeral Converter MCP Server
 *
 * Roman Numeral Converter tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const VALUES: [string, number][] = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]]

const sg = settlegrid.init({ toolSlug: 'roman-numerals', pricing: { defaultCostCents: 1, methods: {
  to_roman: { costCents: 1, displayName: 'Number to Roman' },
  from_roman: { costCents: 1, displayName: 'Roman to Number' },
  validate: { costCents: 1, displayName: 'Validate Roman' },
}}})

const toRoman = sg.wrap(async (args: { number: number }) => {
  if (!Number.isFinite(args.number) || args.number < 1 || args.number > 3999) throw new Error('number required (1-3999)')
  let n = args.number; let result = ''
  for (const [sym, val] of VALUES) { while (n >= val) { result += sym; n -= val } }
  return { number: args.number, roman: result }
}, { method: 'to_roman' })

const fromRoman = sg.wrap(async (args: { roman: string }) => {
  if (!args.roman) throw new Error('roman numeral string required')
  const r = args.roman.toUpperCase()
  const map: Record<string, number> = { I:1,V:5,X:10,L:50,C:100,D:500,M:1000 }
  let total = 0
  for (let i = 0; i < r.length; i++) {
    const curr = map[r[i]] ?? 0
    const next = map[r[i+1]] ?? 0
    total += curr < next ? -curr : curr
  }
  return { roman: args.roman, number: total }
}, { method: 'from_roman' })

const validate = sg.wrap(async (args: { roman: string }) => {
  if (!args.roman) throw new Error('roman required')
  const valid = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(args.roman.toUpperCase())
  return { roman: args.roman, valid }
}, { method: 'validate' })

export { toRoman, fromRoman, validate }
console.log('settlegrid-roman-numerals MCP server ready | Powered by SettleGrid')
