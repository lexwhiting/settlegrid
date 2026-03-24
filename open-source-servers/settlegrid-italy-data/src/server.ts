/**
 * settlegrid-italy-data — Italian Open Data MCP Server
 *
 * Wraps dati.gov.it CKAN API with SettleGrid billing.
 * No API key needed.
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

const API_BASE = 'https://www.dati.gov.it/opendata/api/3'
const USER_AGENT = 'settlegrid-italy-data/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`dati.gov.it API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'italy-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Italian datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_organizations: { costCents: 1, displayName: 'List Italian organizations' },
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

console.log('settlegrid-italy-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
