/**
 * settlegrid-turkey-data — Turkish Statistics MCP Server
 *
 * Wraps World Bank API (TUR) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query)                 — Search indicators (1¢)
 *   list_categories()                      — List topics (1¢)
 *   get_indicator(id)                      — Get indicator data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface ListCategoriesInput {}

interface GetIndicatorInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'TUR'
const USER_AGENT = 'settlegrid-turkey-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`World Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'turkey-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Turkish indicators' },
      list_categories: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', { params: { per_page: '50' } })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_datasets' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_categories' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(`/country/${COUNTRY}/indicator/${args.id}`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, listCategories, getIndicator }

console.log('settlegrid-turkey-data MCP server ready')
console.log('Methods: search_datasets, list_categories, get_indicator')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
