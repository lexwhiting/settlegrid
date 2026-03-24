/**
 * settlegrid-openlibrary — Open Library Book Data MCP Server
 *
 * Wraps the Open Library API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_books(query, limit)  — Search books    (1¢)
 *   get_book(isbn)              — Get by ISBN     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface BookInput {
  isbn: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const OL_BASE = 'https://openlibrary.org'

async function olFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OL_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open Library API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openlibrary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 1, displayName: 'Search Books' },
      get_book: { costCents: 1, displayName: 'Get Book' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await olFetch<{ numFound: number; docs: any[] }>(
    `/search.json?q=${q}&limit=${limit}`
  )
  return {
    query: args.query,
    totalResults: data.numFound,
    books: data.docs.map((d: any) => ({
      key: d.key,
      title: d.title,
      authors: d.author_name || [],
      firstPublishYear: d.first_publish_year,
      isbn: d.isbn?.[0] || null,
      subjects: d.subject?.slice(0, 5) || [],
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    })),
  }
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.isbn || typeof args.isbn !== 'string') {
    throw new Error('isbn is required (ISBN-10 or ISBN-13)')
  }
  const isbn = args.isbn.replace(/[\s-]/g, '')
  if (!/^\d{10}(\d{3})?$/.test(isbn)) {
    throw new Error('isbn must be a valid ISBN-10 or ISBN-13')
  }
  const data = await olFetch<Record<string, any>>(`/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
  const key = `ISBN:${isbn}`
  if (!data[key]) {
    throw new Error(`Book not found for ISBN: ${isbn}`)
  }
  const b = data[key]
  return {
    isbn,
    title: b.title,
    authors: b.authors?.map((a: any) => a.name) || [],
    publishers: b.publishers?.map((p: any) => p.name) || [],
    publishDate: b.publish_date,
    pages: b.number_of_pages,
    subjects: b.subjects?.slice(0, 10).map((s: any) => s.name) || [],
    coverUrl: b.cover?.medium || null,
  }
}, { method: 'get_book' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook }

console.log('settlegrid-openlibrary MCP server ready')
console.log('Methods: search_books, get_book')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
