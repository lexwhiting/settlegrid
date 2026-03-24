/**
 * settlegrid-font-data — Google Fonts Metadata MCP Server
 *
 * Wraps Google Fonts Developer API with SettleGrid billing.
 * No API key needed for basic metadata (uses public endpoint).
 *
 * Methods:
 *   list_fonts(sort?, category?)      — List fonts (1¢)
 *   get_font(family)                  — Get font details (1¢)
 *   search_fonts(query)               — Search fonts (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListFontsInput {
  sort?: string
  category?: string
}

interface GetFontInput {
  family: string
}

interface SearchFontsInput {
  query: string
}

interface GoogleFont {
  family: string
  variants: string[]
  subsets: string[]
  version: string
  lastModified: string
  files: Record<string, string>
  category: string
  kind: string
  menu: string
}

interface GoogleFontsResult {
  kind: string
  items: GoogleFont[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/webfonts/v1'
const USER_AGENT = 'settlegrid-font-data/1.0 (contact@settlegrid.ai)'

let cachedFonts: GoogleFont[] | null = null
let cacheTime = 0
const CACHE_TTL = 3600_000 // 1 hour

async function loadFonts(): Promise<GoogleFont[]> {
  if (cachedFonts && Date.now() - cacheTime < CACHE_TTL) return cachedFonts
  const url = `${API_BASE}/webfonts?sort=popularity`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google Fonts API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as GoogleFontsResult
  cachedFonts = data.items
  cacheTime = Date.now()
  return cachedFonts
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'font-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_fonts: { costCents: 1, displayName: 'List Google Fonts' },
      get_font: { costCents: 1, displayName: 'Get font details' },
      search_fonts: { costCents: 1, displayName: 'Search fonts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listFonts = sg.wrap(async (args: ListFontsInput) => {
  let fonts = await loadFonts()
  if (args.category) {
    const cat = args.category.toLowerCase()
    fonts = fonts.filter(f => f.category.toLowerCase() === cat)
  }
  if (args.sort === 'alpha') {
    fonts = [...fonts].sort((a, b) => a.family.localeCompare(b.family))
  }
  return { total: fonts.length, fonts: fonts.slice(0, 50) }
}, { method: 'list_fonts' })

const getFont = sg.wrap(async (args: GetFontInput) => {
  if (!args.family || typeof args.family !== 'string') {
    throw new Error('family is required (font family name)')
  }
  const fonts = await loadFonts()
  const match = fonts.find(f => f.family.toLowerCase() === args.family.toLowerCase())
  if (!match) throw new Error(`Font "${args.family}" not found`)
  return match
}, { method: 'get_font' })

const searchFonts = sg.wrap(async (args: SearchFontsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (font name search)')
  }
  const fonts = await loadFonts()
  const q = args.query.toLowerCase()
  const matches = fonts.filter(f => f.family.toLowerCase().includes(q))
  return { total: matches.length, fonts: matches.slice(0, 20) }
}, { method: 'search_fonts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listFonts, getFont, searchFonts }

console.log('settlegrid-font-data MCP server ready')
console.log('Methods: list_fonts, get_font, search_fonts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
