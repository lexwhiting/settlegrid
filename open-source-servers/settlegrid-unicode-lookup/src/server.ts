/**
 * settlegrid-unicode-lookup — Unicode Character Lookup MCP Server
 *
 * Unicode Character Lookup tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface LookupInput { char?: string; codepoint?: string }
interface SearchInput { block: string }

const BLOCKS: Record<string, { range: string; sample: string[]; description: string }> = {
  arrows: { range: 'U+2190-U+21FF', sample: ['\u2190','\u2191','\u2192','\u2193','\u2194','\u2195','\u21A9','\u21AA','\u21B0','\u21B3'], description: 'Arrow symbols' },
  math: { range: 'U+2200-U+22FF', sample: ['\u2200','\u2202','\u2203','\u2207','\u2208','\u2209','\u220F','\u2211','\u221A','\u221E'], description: 'Mathematical operators' },
  currency: { range: 'various', sample: ['$','\u20AC','\u00A3','\u00A5','\u20B9','\u20BD','\u20BF','\u20A9','\u20AB','\u20B1'], description: 'Currency symbols' },
  box_drawing: { range: 'U+2500-U+257F', sample: ['\u2500','\u2502','\u250C','\u2510','\u2514','\u2518','\u251C','\u2524','\u252C','\u2534'], description: 'Box drawing characters' },
  emoji: { range: 'U+1F600-U+1F64F', sample: ['\u{1F600}','\u{1F602}','\u{1F60D}','\u{1F914}','\u{1F44D}'], description: 'Emoticons' },
  braille: { range: 'U+2800-U+28FF', sample: ['\u2801','\u2803','\u2809','\u2819','\u2811','\u280B','\u281B','\u2813'], description: 'Braille patterns' },
}

const sg = settlegrid.init({ toolSlug: 'unicode-lookup', pricing: { defaultCostCents: 1, methods: {
  lookup: { costCents: 1, displayName: 'Lookup Character' },
  search: { costCents: 1, displayName: 'Search Block' },
  encode: { costCents: 1, displayName: 'Encode Character' },
}}})

const lookup = sg.wrap(async (args: LookupInput) => {
  if (args.char) {
    const cp = args.char.codePointAt(0)!
    return { character: args.char, codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, decimal: cp, utf8_bytes: new TextEncoder().encode(args.char).length, utf16_units: args.char.length, html_entity: `&#${cp};`, css_escape: `\\${cp.toString(16)}` }
  }
  if (args.codepoint) {
    const cp = parseInt(args.codepoint.replace('U+', ''), 16)
    const char = String.fromCodePoint(cp)
    return { character: char, codepoint: args.codepoint, decimal: cp, utf8_bytes: new TextEncoder().encode(char).length }
  }
  throw new Error('char or codepoint required')
}, { method: 'lookup' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.block) throw new Error('block required')
  const b = BLOCKS[args.block.toLowerCase().replace(/ /g, '_')]
  if (!b) throw new Error(`Unknown block. Available: ${Object.keys(BLOCKS).join(', ')}`)
  return { block: args.block, ...b, sample_with_codes: b.sample.map(c => ({ char: c, codepoint: `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` })) }
}, { method: 'search' })

const encode = sg.wrap(async (args: { text: string }) => {
  if (!args.text) throw new Error('text required')
  const chars = [...args.text].map(c => ({ char: c, codepoint: `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`, decimal: c.codePointAt(0)! }))
  return { text: args.text, characters: chars, count: chars.length }
}, { method: 'encode' })

export { lookup, search, encode }
console.log('settlegrid-unicode-lookup MCP server ready | Powered by SettleGrid')
