/**
 * settlegrid-gutenberg-books — Gutenberg Books MCP Server
 *
 * Wraps Gutendex API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_gutenberg(query, limit?) — search books (1¢)
 *   get_book(id) — book details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface BookInput { id: number }

const API_BASE = 'https://gutendex.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'gutenberg-books',
  pricing: { defaultCostCents: 1, methods: { search_gutenberg: { costCents: 1, displayName: 'Search Books' }, get_book: { costCents: 1, displayName: 'Get Book' } } },
})

const searchGutenberg = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(`/books?search=${encodeURIComponent(args.query)}`)
  return {
    count: data.count,
    books: (data.results || []).slice(0, args.limit ?? 20).map((b: any) => ({
      id: b.id, title: b.title, authors: b.authors?.map((a: any) => a.name),
      languages: b.languages, download_count: b.download_count,
      subjects: b.subjects?.slice(0, 5),
    })),
  }
}, { method: 'search_gutenberg' })

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.id) throw new Error('id is required')
  const data = await apiFetch<any>(`/books/${args.id}`)
  return {
    id: data.id, title: data.title,
    authors: data.authors?.map((a: any) => ({ name: a.name, birth: a.birth_year, death: a.death_year })),
    languages: data.languages, subjects: data.subjects, bookshelves: data.bookshelves,
    download_count: data.download_count,
    formats: data.formats,
  }
}, { method: 'get_book' })

export { searchGutenberg, getBook }

console.log('settlegrid-gutenberg-books MCP server ready')
console.log('Methods: search_gutenberg, get_book')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
