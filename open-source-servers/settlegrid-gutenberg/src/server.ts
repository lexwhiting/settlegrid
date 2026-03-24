/**
 * settlegrid-gutenberg — Project Gutenberg Free Ebooks MCP Server
 *
 * Wraps the free Gutendex API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_books(query)     — Search free ebooks             (1¢)
 *   get_book(id)            — Get book details by ID         (1¢)
 *   get_popular(topic?)     — Get popular/downloaded ebooks  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetBookInput { id: number }
interface PopularInput { topic?: string }

interface GutenbergBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>
  subjects: string[]
  bookshelves: string[]
  languages: string[]
  download_count: number
  formats: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gutendex.com'

async function gutenbergFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gutendex API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatBook(b: GutenbergBook) {
  return {
    id: b.id,
    title: b.title,
    authors: b.authors.map(a => a.name),
    subjects: b.subjects.slice(0, 5),
    languages: b.languages,
    downloadCount: b.download_count,
    readOnline: b.formats['text/html'] || null,
    plainText: b.formats['text/plain; charset=utf-8'] || b.formats['text/plain'] || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gutenberg',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 1, displayName: 'Search Books' },
      get_book: { costCents: 1, displayName: 'Get Book Details' },
      get_popular: { costCents: 1, displayName: 'Popular Books' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await gutenbergFetch<{ count: number; results: GutenbergBook[] }>(`/books?search=${q}`)
  return { query: args.query, count: data.count, books: data.results.slice(0, 15).map(formatBook) }
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: GetBookInput) => {
  if (typeof args.id !== 'number' || args.id < 1) {
    throw new Error('id must be a positive number')
  }
  const book = await gutenbergFetch<GutenbergBook>(`/books/${args.id}`)
  return formatBook(book)
}, { method: 'get_book' })

const getPopular = sg.wrap(async (args: PopularInput) => {
  const topicParam = args.topic ? `&topic=${encodeURIComponent(args.topic)}` : ''
  const data = await gutenbergFetch<{ count: number; results: GutenbergBook[] }>(`/books?sort=popular${topicParam}`)
  return { topic: args.topic || 'all', count: data.count, books: data.results.slice(0, 15).map(formatBook) }
}, { method: 'get_popular' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook, getPopular }

console.log('settlegrid-gutenberg MCP server ready')
console.log('Methods: search_books, get_book, get_popular')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
