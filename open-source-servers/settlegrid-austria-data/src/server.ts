/**
 * settlegrid-austria-data — Austrian Open Data MCP Server
 *
 * Wraps data.gv.at CKAN with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_organizations(limit?)             — List organizations (1¢)
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

interface ListOrganizationsInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.data.gv.at/katalog/api/3'
const USER_AGENT = 'settlegrid-austria-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const res = await fetch(url.toString(), { method: options.method ?? 'GET', headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`data.gv.at CKAN API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'austria-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Austrian Open Data datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_organizations: { costCents: 1, displayName: 'List publishing organizations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/package_search', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>('/action/package_show', {
    params: { id: args.id },
  })
  return data
}, { method: 'get_dataset' })

const listOrganizations = sg.wrap(async (args: ListOrganizationsInput) => {
  const params: Record<string, string> = { all_fields: 'true' }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/organization_list', { params })
  return data
}, { method: 'list_organizations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listOrganizations }

console.log('settlegrid-austria-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
