/**
 * settlegrid-openlibrary-books — Open Library Books MCP Server
 *
 * Wraps Open Library API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_books(query, limit?) — search books (1¢)
 *   get_book_by_isbn(isbn) — book by ISBN (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface IsbnInput { isbn: string }

const API_BASE = 'https://openlibrary.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'openlibrary-books',
  pricing: { defaultCostCents: 1, methods: { search_books: { costCents: 1, displayName: 'Search Books' }, get_book_by_isbn: { costCents: 1, displayName: 'Book By ISBN' } } },
})

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`/search.json?q=${encodeURIComponent(args.query)}&limit=${limit}`)
  return {
    total: data.numFound,
    books: (data.docs || []).map((b: any) => ({
      key: b.key, title: b.title, author: b.author_name?.[0],
      first_publish_year: b.first_publish_year, isbn: b.isbn?.[0],
      subject: b.subject?.slice(0, 5), language: b.language?.slice(0, 3),
      edition_count: b.edition_count, cover_id: b.cover_i,
    })),
  }
}, { method: 'search_books' })

const getBookByIsbn = sg.wrap(async (args: IsbnInput) => {
  if (!args.isbn) throw new Error('isbn is required')
  const data = await apiFetch<any>(`/api/books?bibkeys=ISBN:${args.isbn}&format=json&jscmd=data`)
  const key = `ISBN:${args.isbn}`
  const book = data[key]
  if (!book) throw new Error('Book not found for this ISBN')
  return {
    title: book.title, authors: book.authors?.map((a: any) => a.name),
    publishers: book.publishers?.map((p: any) => p.name),
    publish_date: book.publish_date, pages: book.number_of_pages,
    subjects: book.subjects?.slice(0, 5).map((s: any) => s.name),
    cover: book.cover, url: book.url,
  }
}, { method: 'get_book_by_isbn' })

export { searchBooks, getBookByIsbn }

console.log('settlegrid-openlibrary-books MCP server ready')
console.log('Methods: search_books, get_book_by_isbn')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
