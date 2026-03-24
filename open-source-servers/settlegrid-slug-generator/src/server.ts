/**
 * settlegrid-slug-generator — URL Slug Generator MCP Server
 *
 * Local computation — no external API needed.
 *
 * Methods:
 *   slugify(text)         — Generate URL-safe slug        (1¢)
 *   transliterate(text)   — Transliterate to ASCII        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextInput {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TRANSLITERATION_MAP: Record<string, string> = {
  'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f', 'g': 'g',
  // Accented Latin
  '\u00e0': 'a', '\u00e1': 'a', '\u00e2': 'a', '\u00e3': 'a', '\u00e4': 'ae', '\u00e5': 'a',
  '\u00e6': 'ae', '\u00e7': 'c', '\u00e8': 'e', '\u00e9': 'e', '\u00ea': 'e', '\u00eb': 'e',
  '\u00ec': 'i', '\u00ed': 'i', '\u00ee': 'i', '\u00ef': 'i', '\u00f0': 'd', '\u00f1': 'n',
  '\u00f2': 'o', '\u00f3': 'o', '\u00f4': 'o', '\u00f5': 'o', '\u00f6': 'oe', '\u00f8': 'o',
  '\u00f9': 'u', '\u00fa': 'u', '\u00fb': 'u', '\u00fc': 'ue', '\u00fd': 'y', '\u00ff': 'y',
  '\u00df': 'ss',
  // Eastern European
  '\u0107': 'c', '\u010d': 'c', '\u0111': 'd', '\u017e': 'z', '\u0161': 's',
  '\u0142': 'l', '\u0144': 'n', '\u015b': 's', '\u017a': 'z', '\u017c': 'z',
  // Turkish
  '\u011f': 'g', '\u0131': 'i', '\u015f': 's',
  // German uppercase
  '\u00c4': 'Ae', '\u00d6': 'Oe', '\u00dc': 'Ue',
}

function transliterateChar(char: string): string {
  return TRANSLITERATION_MAP[char] || char
}

function doTransliterate(text: string): string {
  return text
    .normalize('NFD')
    .split('')
    .map((c) => {
      const mapped = transliterateChar(c)
      if (mapped !== c) return mapped
      // Strip combining marks
      if (/[\u0300-\u036f]/.test(c)) return ''
      return c
    })
    .join('')
}

function doSlugify(text: string): string {
  return doTransliterate(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

function validateText(text: unknown): string {
  if (!text || typeof text !== 'string') throw new Error('text is required')
  if (text.length > 5000) throw new Error('Text too long (max 5,000 chars)')
  return text
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'slug-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      slugify: { costCents: 1, displayName: 'Generate Slug' },
      transliterate: { costCents: 1, displayName: 'Transliterate' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const slugify = sg.wrap(async (args: TextInput) => {
  const text = validateText(args.text)
  const slug = doSlugify(text)

  return {
    input: text,
    slug,
    length: slug.length,
    wordCount: slug.split('-').filter(Boolean).length,
  }
}, { method: 'slugify' })

const transliterate = sg.wrap(async (args: TextInput) => {
  const text = validateText(args.text)
  const result = doTransliterate(text)

  const hasNonAscii = /[^\x00-\x7F]/.test(text)
  const remainingNonAscii = /[^\x00-\x7F]/.test(result)

  return {
    input: text,
    transliterated: result,
    hadNonAscii: hasNonAscii,
    isFullyAscii: !remainingNonAscii,
    inputLength: text.length,
    outputLength: result.length,
  }
}, { method: 'transliterate' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { slugify, transliterate }

console.log('settlegrid-slug-generator MCP server ready')
console.log('Methods: slugify, transliterate')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
