/**
 * settlegrid-imslp — IMSLP Sheet Music MCP Server
 *
 * Wraps IMSLP (Petrucci Music Library) MediaWiki API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_works(query, limit?)       — Search works (1¢)
 *   get_work(title)                   — Get work details (1¢)
 *   search_composers(query)           — Search composers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchWorksInput {
  query: string
  limit?: number
}

interface GetWorkInput {
  title: string
}

interface SearchComposersInput {
  query: string
}

interface MediaWikiSearchResult {
  query: {
    search: Array<{
      ns: number
      title: string
      snippet: string
      size: number
      [key: string]: unknown
    }>
    searchinfo: { totalhits: number }
  }
}

interface MediaWikiParseResult {
  parse: {
    title: string
    pageid: number
    text: { '*': string }
    categories: Array<{ '*': string }>
    externallinks: string[]
    [key: string]: unknown
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://imslp.org/api.php'
const USER_AGENT = 'settlegrid-imslp/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IMSLP API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imslp',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search IMSLP works' },
      get_work: { costCents: 1, displayName: 'Get work details' },
      search_composers: { costCents: 1, displayName: 'Search composers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchWorksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (musical work search term)')
  }
  const limit = args.limit ?? 10
  return apiFetch<MediaWikiSearchResult>({
    action: 'query',
    list: 'search',
    srsearch: args.query,
    srnamespace: '0',
    srlimit: String(limit),
  })
}, { method: 'search_works' })

const getWork = sg.wrap(async (args: GetWorkInput) => {
  if (!args.title || typeof args.title !== 'string') {
    throw new Error('title is required (exact IMSLP page title)')
  }
  return apiFetch<MediaWikiParseResult>({
    action: 'parse',
    page: args.title,
    prop: 'text|categories|externallinks',
  })
}, { method: 'get_work' })

const searchComposers = sg.wrap(async (args: SearchComposersInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (composer name)')
  }
  return apiFetch<MediaWikiSearchResult>({
    action: 'query',
    list: 'search',
    srsearch: `Category:${args.query}`,
    srnamespace: '14',
    srlimit: '20',
  })
}, { method: 'search_composers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getWork, searchComposers }

console.log('settlegrid-imslp MCP server ready')
console.log('Methods: search_works, get_work, search_composers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
