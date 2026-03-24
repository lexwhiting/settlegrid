/**
 * settlegrid-isbn-lookup — ISBN Lookup MCP Server
 *
 * Wraps Open Library ISBN endpoint with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   lookup_isbn(isbn) — book by ISBN (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface IsbnInput { isbn: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'isbn-lookup',
  pricing: { defaultCostCents: 1, methods: { lookup_isbn: { costCents: 1, displayName: 'Lookup ISBN' } } },
})

const lookupIsbn = sg.wrap(async (args: IsbnInput) => {
  if (!args.isbn) throw new Error('isbn is required')
  const data = await apiFetch<any>(`https://openlibrary.org/isbn/${args.isbn}.json`)
  return {
    title: data.title, publishers: data.publishers, publish_date: data.publish_date,
    pages: data.number_of_pages, isbn_10: data.isbn_10, isbn_13: data.isbn_13,
    subjects: data.subjects?.slice(0, 10), key: data.key,
    covers: data.covers?.map((id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`),
  }
}, { method: 'lookup_isbn' })

export { lookupIsbn }

console.log('settlegrid-isbn-lookup MCP server ready')
console.log('Methods: lookup_isbn')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
