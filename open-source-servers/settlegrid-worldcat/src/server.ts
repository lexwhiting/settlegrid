/**
 * settlegrid-worldcat — WorldCat Library Catalog MCP Server
 *
 * Wraps WorldCat Search API with SettleGrid billing.
 * Requires a free API key from https://www.oclc.org/developer
 *
 * Methods:
 *   search_books(query, limit?)       — Search books (2¢)
 *   get_book(oclcNumber)              — Get book details (1¢)
 *   search_libraries(zip)             — Search libraries by ZIP (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBooksInput {
  query: string
  limit?: number
}

interface GetBookInput {
  oclcNumber: string
}

interface SearchLibrariesInput {
  zip: string
}

interface WorldCatRecord {
  oclcNumber: string
  title: string
  creator: string
  date: string
  language: string
  generalFormat: string
  publisher: string
  [key: string]: unknown
}

interface WorldCatSearchResult {
  numberOfRecords: number
  briefRecords: WorldCatRecord[]
}

interface WorldCatDetailResult {
  identifier: Record<string, unknown>
  title: Record<string, unknown>
  contributor: Record<string, unknown>
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://search.worldcat.org/api'
const API_KEY = process.env.WORLDCAT_API_KEY ?? ''
const USER_AGENT = 'settlegrid-worldcat/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WorldCat API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'worldcat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 2, displayName: 'Search WorldCat books' },
      get_book: { costCents: 1, displayName: 'Get book by OCLC number' },
      search_libraries: { costCents: 2, displayName: 'Search libraries by ZIP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchBooksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<WorldCatSearchResult>('/search', params)
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: GetBookInput) => {
  if (!args.oclcNumber || typeof args.oclcNumber !== 'string') {
    throw new Error('oclcNumber is required (OCLC catalog number)')
  }
  return apiFetch<WorldCatDetailResult>(`/bibs/${args.oclcNumber}`)
}, { method: 'get_book' })

const searchLibraries = sg.wrap(async (args: SearchLibrariesInput) => {
  if (!args.zip || typeof args.zip !== 'string') {
    throw new Error('zip is required (ZIP/postal code)')
  }
  return apiFetch<Record<string, unknown>>('/libraries', {
    lat: '',
    lon: '',
    postalCode: args.zip,
    distance: '25',
    unit: 'mi',
  })
}, { method: 'search_libraries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook, searchLibraries }

console.log('settlegrid-worldcat MCP server ready')
console.log('Methods: search_books, get_book, search_libraries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
