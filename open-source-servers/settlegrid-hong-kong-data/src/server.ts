/**
 * settlegrid-hong-kong-data — Hong Kong Open Data MCP Server
 *
 * Wraps DATA.GOV.HK API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query)                 — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_categories()                      — List categories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface GetDatasetInput {
  id: string
}

interface ListCategoriesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.gov.hk/en-data'
const USER_AGENT = 'settlegrid-hong-kong-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
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
    throw new Error(`DATA.GOV.HK API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hong-kong-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search HK datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_categories: { costCents: 1, displayName: 'List data categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/dataset-search', {
    params: { q: args.query },
  })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/dataset/${encodeURIComponent(args.id)}`)
  return data
}, { method: 'get_dataset' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/category-list')
  return data
}, { method: 'list_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCategories }

console.log('settlegrid-hong-kong-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
