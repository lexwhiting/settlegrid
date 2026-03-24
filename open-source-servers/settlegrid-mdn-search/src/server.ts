/**
 * settlegrid-mdn-search — MDN Web Docs MCP Server
 *
 * Search Mozilla Developer Network web documentation.
 *
 * Methods:
 *   search_docs(query)            — Search MDN web documentation articles  (1¢)
 *   get_document(slug)            — Get a specific MDN document by slug  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDocsInput {
  query: string
}

interface GetDocumentInput {
  slug: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://developer.mozilla.org/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-mdn-search/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MDN Web Docs API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mdn-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_docs: { costCents: 1, displayName: 'Search Docs' },
      get_document: { costCents: 1, displayName: 'Get Document' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDocs = sg.wrap(async (args: SearchDocsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}&locale=en-US`)
  const items = (data.documents ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        mdn_url: item.mdn_url,
    })),
  }
}, { method: 'search_docs' })

const getDocument = sg.wrap(async (args: GetDocumentInput) => {
  if (!args.slug || typeof args.slug !== 'string') throw new Error('slug is required')
  const slug = args.slug.trim()
  const data = await apiFetch<any>(`/doc/en-US/${encodeURIComponent(slug)}`)
  return {
    title: data.title,
    summary: data.summary,
    mdn_url: data.mdn_url,
    modified: data.modified,
  }
}, { method: 'get_document' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDocs, getDocument }

console.log('settlegrid-mdn-search MCP server ready')
console.log('Methods: search_docs, get_document')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
