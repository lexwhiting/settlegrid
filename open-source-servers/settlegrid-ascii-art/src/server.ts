/**
 * settlegrid-ascii-art — ASCII Art Generator MCP Server
 *
 * Converts text to ASCII art banners and provides a gallery of ASCII artworks.
 * All rendering done locally with a comprehensive character set.
 *
 * Methods:
 *   text_to_art(text, style?)     — Convert text to ASCII banner    (1¢)
 *   get_art(name)                 — Get pre-made ASCII artwork      (1¢)
 *   list_art()                    — List available artworks         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextToArtInput {
  text: string
  style?: string
}

interface GetArtInput {
  name: string
}

// ─── Data ───────────────────────────────────────────────────────────────────

const FONT_BLOCK: Record<string, string[]> = {
  A: ['  #  ', ' # # ', '#####', '#   #', '#   #'],
  B: ['#### ', '#   #', '#### ', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#### ', '#    ', '#####'],
  F: ['#####', '#    ', '#### ', '#    ', '#    '],
  G: [' ####', '#    ', '# ###', '#   #', ' ####'],
  H: ['#   #', '#   #', '#####', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['#####', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '###  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#### ', '#    ', '#    '],
  Q: [' ### ', '#   #', '# # #', '#  ##', ' ####'],
  R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', ' # # ', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  X: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
  ' ': ['     ', '     ', '     ', '     ', '     '],
  '0': [' ### ', '#   #', '#   #', '#   #', ' ### '],
  '1': ['  #  ', ' ##  ', '  #  ', '  #  ', ' ### '],
  '2': [' ### ', '    #', ' ### ', '#    ', '#####'],
  '3': [' ### ', '    #', ' ### ', '    #', ' ### '],
  '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '],
}

const FONT_SLIM: Record<string, string[]> = {
  A: [' _ ', '|_|', '| |'],
  B: ['|_ ', '|_)', '|_)'],
  C: [' _ ', '|  ', '|_ '],
  D: ['_  ', '| \\', '|_/'],
  E: [' _ ', '|_ ', '|_ '],
  F: [' _ ', '|_ ', '|  '],
  G: [' _ ', '|  ', '|_|'],
  H: ['   ', '|_|', '| |'],
  I: ['_', '|', '|'],
  J: [' _', ' |', '_|'],
  K: ['   ', '|/ ', '|\\ '],
  L: ['   ', '|  ', '|_ '],
  M: ['    ', '|\\/|', '|  |'],
  N: ['   ', '|\\ ', '| \\'],
  O: [' _ ', '| |', '|_|'],
  P: [' _ ', '|_)', '|  '],
  Q: [' _ ', '| |', '|_\\'],
  R: [' _ ', '|_)', '| \\'],
  S: [' _ ', '|_ ', ' _|'],
  T: ['___', ' | ', ' | '],
  U: ['   ', '| |', '|_|'],
  V: ['   ', '\\ /', ' v '],
  W: ['    ', '|  |', '|/\\|'],
  X: ['   ', '\\/ ', '/\\ '],
  Y: ['   ', '\\/ ', ' | '],
  Z: ['__ ', ' / ', '/_ '],
  ' ': ['  ', '  ', '  '],
}

const ARTWORKS: Record<string, { art: string; category: string }> = {
  cat: { art: '  /\\_/\\\n ( o.o )\n  > ^ <', category: 'animals' },
  dog: { art: '  / \\__\n (    @\\___\n /         O\n/   (_____/\n/_____/', category: 'animals' },
  fish: { art: '  /`-._\n /  ,..\\\n|  ;   |\n \\  `--/', category: 'animals' },
  heart: { art: '  ** **\n *    *\n *    *\n  *  *\n   **', category: 'symbols' },
  star: { art: '    *\n   ***\n *******\n  *****\n   ***\n  ** **', category: 'symbols' },
  rocket: { art: '   /\\\n  /  \\\n |    |\n |    |\n /|  |\\\n/ |  | \\', category: 'objects' },
  house: { art: '    /\\\n   /  \\\n  /    \\\n /______\\\n |  __  |\n | |  | |\n |_|__|_|', category: 'objects' },
  tree: { art: '    *\n   /|\\\n  / | \\\n /  |  \\\n    |\n    |', category: 'nature' },
  coffee: { art: '   ( (\n    ) )\n  ........\n  |      |]\n  \\      /\n   `----\'', category: 'objects' },
  skull: { art: '  _____ \n /     \\\n| () () |\n \\  ^  /\n  |||||', category: 'symbols' },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ascii-art',
  pricing: {
    defaultCostCents: 1,
    methods: {
      text_to_art: { costCents: 1, displayName: 'Text to ASCII Art' },
      get_art: { costCents: 1, displayName: 'Get ASCII Art' },
      list_art: { costCents: 1, displayName: 'List Artworks' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const textToArt = sg.wrap(async (args: TextToArtInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required')
  }
  if (args.text.length > 30) {
    throw new Error('text must be 30 characters or fewer')
  }

  const style = (args.style ?? 'block').toLowerCase()
  const font = style === 'slim' ? FONT_SLIM : FONT_BLOCK
  const height = style === 'slim' ? 3 : 5
  const chars = args.text.toUpperCase().split('')
  const rows: string[] = Array.from({ length: height }, () => '')

  for (const c of chars) {
    const glyph = font[c] ?? Array.from({ length: height }, () => '?')
    for (let i = 0; i < height; i++) {
      rows[i] += (glyph[i] ?? '') + ' '
    }
  }

  return {
    text: args.text,
    style,
    art: rows.join('\n'),
    width: rows[0].length,
    height,
    available_styles: ['block', 'slim'],
  }
}, { method: 'text_to_art' })

const getArt = sg.wrap(async (args: GetArtInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required')
  }
  const key = args.name.toLowerCase()
  const artwork = ARTWORKS[key]
  if (!artwork) {
    throw new Error(`Unknown artwork "${args.name}". Available: ${Object.keys(ARTWORKS).join(', ')}`)
  }
  return {
    name: key,
    art: artwork.art,
    category: artwork.category,
    lines: artwork.art.split('\n').length,
  }
}, { method: 'get_art' })

const listArt = sg.wrap(async (_args: Record<string, never>) => {
  const items = Object.entries(ARTWORKS).map(([name, data]) => ({
    name,
    category: data.category,
    lines: data.art.split('\n').length,
  }))
  const categories = [...new Set(items.map(i => i.category))]
  return { count: items.length, categories, artworks: items }
}, { method: 'list_art' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { textToArt, getArt, listArt }

console.log('settlegrid-ascii-art MCP server ready')
console.log('Methods: text_to_art, get_art, list_art')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
