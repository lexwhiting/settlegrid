/**
 * settlegrid-poland-data — Polish Open Data MCP Server
 *
 * Wraps dane.gov.pl API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_categories()                      — List categories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListCategoriesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dane.gov.pl/1.4'
const USER_AGENT = 'settlegrid-poland-data/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`dane.gov.pl API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'poland-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Polish datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_categories: { costCents: 1, displayName: 'List dataset categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['per_page'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/datasets', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/datasets/${encodeURIComponent(args.id)}`)
  return data
}, { method: 'get_dataset' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/categories')
  return data
}, { method: 'list_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCategories }

console.log('settlegrid-poland-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
