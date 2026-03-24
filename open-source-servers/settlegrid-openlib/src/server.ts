/**
 * settlegrid-openlib — Open Library MCP Server
 *
 * Wraps the Open Library API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_books(q)                          (1¢)
 *   get_book(isbn)                           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBooksInput {
  q: string
  limit?: number
}

interface GetBookInput {
  isbn: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://openlibrary.org'
const USER_AGENT = 'settlegrid-openlib/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Library API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openlib',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 1, displayName: 'Search for books by title, author, or subject' },
      get_book: { costCents: 1, displayName: 'Get book details by ISBN' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchBooksInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/search.json', {
    params,
  })

  return data
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: GetBookInput) => {
  if (!args.isbn || typeof args.isbn !== 'string') {
    throw new Error('isbn is required (isbn number)')
  }

  const params: Record<string, string> = {}
  params['isbn'] = String(args.isbn)

  const data = await apiFetch<Record<string, unknown>>(`/isbn/${encodeURIComponent(String(args.isbn))}.json`, {
    params,
  })

  return data
}, { method: 'get_book' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook }

console.log('settlegrid-openlib MCP server ready')
console.log('Methods: search_books, get_book')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
