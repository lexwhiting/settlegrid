/**
 * settlegrid-loc — Library of Congress MCP Server
 *
 * Wraps Library of Congress JSON API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_items(query, limit?)       — Search items (1¢)
 *   get_item(id)                      — Get item details (1¢)
 *   search_collections(query)         — Search collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchItemsInput {
  query: string
  limit?: number
}

interface GetItemInput {
  id: string
}

interface SearchCollectionsInput {
  query: string
}

interface LocResult {
  id: string
  title: string
  date: string
  description: string[]
  url: string
  [key: string]: unknown
}

interface LocSearchResponse {
  results: LocResult[]
  count: number
  pages: number
  [key: string]: unknown
}

interface LocItemResponse {
  item: Record<string, unknown>
  resources: Array<Record<string, unknown>>
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.loc.gov'
const USER_AGENT = 'settlegrid-loc/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('fo', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LOC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'loc',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_items: { costCents: 1, displayName: 'Search LOC items' },
      get_item: { costCents: 1, displayName: 'Get item details' },
      search_collections: { costCents: 1, displayName: 'Search LOC collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchItems = sg.wrap(async (args: SearchItemsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['c'] = String(args.limit)
  return apiFetch<LocSearchResponse>('/search/', params)
}, { method: 'search_items' })

const getItem = sg.wrap(async (args: GetItemInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (LOC item ID or URL path)')
  }
  const path = args.id.startsWith('/') ? args.id : `/item/${args.id}`
  return apiFetch<LocItemResponse>(path)
}, { method: 'get_item' })

const searchCollections = sg.wrap(async (args: SearchCollectionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (collection search)')
  }
  return apiFetch<LocSearchResponse>('/collections/', { q: args.query })
}, { method: 'search_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchItems, getItem, searchCollections }

console.log('settlegrid-loc MCP server ready')
console.log('Methods: search_items, get_item, search_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
