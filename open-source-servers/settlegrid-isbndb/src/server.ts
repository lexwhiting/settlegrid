/**
 * settlegrid-isbndb — ISBNdb Book Lookup MCP Server
 *
 * Wraps the ISBNdb API with SettleGrid billing.
 * Requires an ISBNdb API key.
 *
 * Methods:
 *   get_book(isbn)        — Get book by ISBN       (2¢)
 *   search_books(query)   — Search books           (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookInput {
  isbn: string
}

interface SearchInput {
  query: string
  page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ISBN_BASE = 'https://api2.isbndb.com'
const API_KEY = process.env.ISBNDB_API_KEY || ''

async function isbnFetch<T>(path: string): Promise<T> {
  if (!API_KEY) {
    throw new Error('ISBNDB_API_KEY environment variable is required')
  }
  const res = await fetch(`${ISBN_BASE}${path}`, {
    headers: { Authorization: API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ISBNdb API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'isbndb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_book: { costCents: 2, displayName: 'Get Book' },
      search_books: { costCents: 2, displayName: 'Search Books' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.isbn || typeof args.isbn !== 'string') {
    throw new Error('isbn is required')
  }
  const isbn = args.isbn.replace(/[\s-]/g, '')
  if (!/^\d{10}(\d{3})?$/.test(isbn)) {
    throw new Error('isbn must be a valid ISBN-10 or ISBN-13')
  }
  const data = await isbnFetch<{ book: any }>(`/book/${isbn}`)
  const b = data.book
  return {
    isbn: isbn,
    isbn13: b.isbn13,
    title: b.title,
    titleLong: b.title_long,
    authors: b.authors || [],
    publisher: b.publisher,
    publishDate: b.date_published,
    pages: b.pages,
    language: b.language,
    subjects: b.subjects || [],
    synopsis: b.synopsis?.slice(0, 1000),
  }
}, { method: 'get_book' })

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const page = Math.max(args.page ?? 1, 1)
  const q = encodeURIComponent(args.query)
  const data = await isbnFetch<{ total: number; books: any[] }>(
    `/books/${q}?page=${page}&pageSize=10`
  )
  return {
    query: args.query,
    total: data.total,
    books: (data.books || []).map((b: any) => ({
      isbn13: b.isbn13,
      title: b.title,
      authors: b.authors || [],
      publisher: b.publisher,
      publishDate: b.date_published,
      pages: b.pages,
    })),
  }
}, { method: 'search_books' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBook, searchBooks }

console.log('settlegrid-isbndb MCP server ready')
console.log('Methods: get_book, search_books')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
