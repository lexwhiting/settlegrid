/**
 * settlegrid-braille-converter — Braille Translation MCP Server
 *
 * Converts text to/from Unicode Braille patterns. Supports Grade 1
 * (uncontracted) Braille with letters, numbers, and common punctuation.
 *
 * Methods:
 *   to_braille(text)              — Convert text to Braille Unicode  (1¢)
 *   from_braille(braille)         — Convert Braille to text          (1¢)
 *   get_cell(char)                — Get Braille cell dot pattern     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToBrailleInput {
  text: string
}

interface FromBrailleInput {
  braille: string
}

interface GetCellInput {
  char: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const CHAR_TO_BRAILLE: Record<string, string> = {
  a: '\u2801', b: '\u2803', c: '\u2809', d: '\u2819', e: '\u2811',
  f: '\u280B', g: '\u281B', h: '\u2813', i: '\u280A', j: '\u281A',
  k: '\u2805', l: '\u2807', m: '\u280D', n: '\u281D', o: '\u2815',
  p: '\u280F', q: '\u281F', r: '\u2817', s: '\u280E', t: '\u281E',
  u: '\u2825', v: '\u2827', w: '\u283A', x: '\u282D', y: '\u283D',
  z: '\u2835', ' ': '\u2800',
  '0': '\u281A', '1': '\u2801', '2': '\u2803', '3': '\u2809',
  '4': '\u2819', '5': '\u2811', '6': '\u280B', '7': '\u281B',
  '8': '\u2813', '9': '\u280A',
  '.': '\u2832', ',': '\u2802', '!': '\u2816', '?': '\u2826',
  ';': '\u2806', ':': '\u2812', '-': '\u2824', '\'': '\u2804',
}

const DOT_PATTERNS: Record<string, string> = {
  '\u2801': '1', '\u2803': '12', '\u2809': '14', '\u2819': '145',
  '\u2811': '15', '\u280B': '124', '\u281B': '1245', '\u2813': '125',
  '\u280A': '24', '\u281A': '245', '\u2805': '13', '\u2807': '123',
  '\u280D': '134', '\u281D': '1345', '\u2815': '135', '\u280F': '1234',
  '\u281F': '12345', '\u2817': '1235', '\u280E': '234', '\u281E': '2345',
  '\u2825': '136', '\u2827': '1236', '\u283A': '2456', '\u282D': '1346',
  '\u283D': '13456', '\u2835': '1356', '\u2800': '',
}

const BRAILLE_TO_CHAR: Record<string, string> = {}
for (const [char, braille] of Object.entries(CHAR_TO_BRAILLE)) {
  if (!BRAILLE_TO_CHAR[braille]) {
    BRAILLE_TO_CHAR[braille] = char
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'braille-converter',
  pricing: {
    defaultCostCents: 1,
    methods: {
      to_braille: { costCents: 1, displayName: 'Text to Braille' },
      from_braille: { costCents: 1, displayName: 'Braille to Text' },
      get_cell: { costCents: 1, displayName: 'Get Braille Cell' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const toBraille = sg.wrap(async (args: ToBrailleInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required')
  }
  if (args.text.length > 500) {
    throw new Error('text must be 500 characters or fewer')
  }

  const chars = args.text.toLowerCase().split('')
  const brailleChars: string[] = []
  let unknownCount = 0

  for (const c of chars) {
    const b = CHAR_TO_BRAILLE[c]
    if (b) {
      brailleChars.push(b)
    } else {
      brailleChars.push(c)
      unknownCount++
    }
  }

  return {
    original: args.text,
    braille: brailleChars.join(''),
    char_count: args.text.length,
    braille_cells: brailleChars.length,
    unmapped_characters: unknownCount,
    grade: 'Grade 1 (uncontracted)',
  }
}, { method: 'to_braille' })

const fromBraille = sg.wrap(async (args: FromBrailleInput) => {
  if (!args.braille || typeof args.braille !== 'string') {
    throw new Error('braille is required (Unicode Braille characters)')
  }

  const chars = args.braille.split('')
  const textChars: string[] = []
  let unknownCount = 0

  for (const c of chars) {
    const t = BRAILLE_TO_CHAR[c]
    if (t) {
      textChars.push(t)
    } else {
      textChars.push(c)
      unknownCount++
    }
  }

  return {
    braille: args.braille,
    text: textChars.join(''),
    cell_count: args.braille.length,
    unmapped_cells: unknownCount,
  }
}, { method: 'from_braille' })

const getCell = sg.wrap(async (args: GetCellInput) => {
  if (!args.char || typeof args.char !== 'string') {
    throw new Error('char is required (single character)')
  }
  const c = args.char.toLowerCase()[0]
  const braille = CHAR_TO_BRAILLE[c]
  if (!braille) {
    throw new Error(`No Braille mapping for "${c}". Supported: letters, digits, common punctuation.`)
  }

  const dots = DOT_PATTERNS[braille] ?? ''
  return {
    character: c,
    braille,
    dots: dots || 'empty cell',
    dot_positions: dots.split('').map(Number),
    unicode_codepoint: `U+${braille.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
  }
}, { method: 'get_cell' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { toBraille, fromBraille, getCell }

console.log('settlegrid-braille-converter MCP server ready')
console.log('Methods: to_braille, from_braille, get_cell')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
