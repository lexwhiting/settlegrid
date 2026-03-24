/**
 * settlegrid-crossref — Crossref DOI/Citation MCP Server
 *
 * Wraps the Crossref REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_works(query, rows)  — Search works          (1¢)
 *   get_doi(doi)               — Get DOI metadata      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  rows?: number
}

interface DoiInput {
  doi: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CR_BASE = 'https://api.crossref.org'
const MAILTO = 'mailto=contact@settlegrid.ai'

async function crFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${CR_BASE}${path}${sep}${MAILTO}`, {
    headers: { 'User-Agent': 'settlegrid-crossref/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Crossref API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'crossref',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search Works' },
      get_doi: { costCents: 1, displayName: 'Get DOI' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const rows = Math.min(Math.max(args.rows ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await crFetch<{ message: { items: any[]; 'total-results': number } }>(
    `/works?query=${q}&rows=${rows}`
  )
  return {
    query: args.query,
    totalResults: data.message['total-results'],
    items: data.message.items.map((w: any) => ({
      doi: w.DOI,
      title: w.title?.[0] || '',
      type: w.type,
      published: w.published?.['date-parts']?.[0]?.join('-'),
      citationCount: w['is-referenced-by-count'],
      publisher: w.publisher,
    })),
  }
}, { method: 'search_works' })

const getDoi = sg.wrap(async (args: DoiInput) => {
  if (!args.doi || typeof args.doi !== 'string') {
    throw new Error('doi is required (e.g. "10.1038/nature12373")')
  }
  const data = await crFetch<{ message: any }>(`/works/${encodeURIComponent(args.doi)}`)
  const w = data.message
  return {
    doi: w.DOI,
    title: w.title?.[0] || '',
    authors: w.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || [],
    type: w.type,
    published: w.published?.['date-parts']?.[0]?.join('-'),
    citationCount: w['is-referenced-by-count'],
    publisher: w.publisher,
    abstract: w.abstract?.slice(0, 1000),
  }
}, { method: 'get_doi' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getDoi }

console.log('settlegrid-crossref MCP server ready')
console.log('Methods: search_works, get_doi')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
