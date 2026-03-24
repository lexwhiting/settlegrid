/**
 * settlegrid-paleoclimate — Paleoclimate Data MCP Server
 * Wraps NOAA Paleoclimatology API with SettleGrid billing.
 * Methods:
 *   search_datasets(query, type?) — Search datasets (1¢)
 *   get_dataset(id)               — Get dataset details (1¢)
 *   list_data_types()             — List data types (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  type?: string
}

interface DatasetInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.ncei.noaa.gov/access/paleo-search/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-paleoclimate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NOAA Paleo API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'paleoclimate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search paleoclimate datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_data_types: { costCents: 1, displayName: 'List data types' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const params: Record<string, string> = {
    searchText: args.query,
    limit: '20',
    offset: '0',
  }
  if (args.type) params.dataTypeId = args.type
  return apiFetch<unknown>('search', params)
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(`study/${encodeURIComponent(args.id)}`)
}, { method: 'get_dataset' })

const listDataTypes = sg.wrap(async () => {
  return {
    types: [
      { id: 'ice_core', name: 'Ice Cores' },
      { id: 'tree_ring', name: 'Tree Rings' },
      { id: 'coral', name: 'Coral' },
      { id: 'lake_sediment', name: 'Lake Sediments' },
      { id: 'marine_sediment', name: 'Marine Sediments' },
      { id: 'speleothem', name: 'Speleothems (Cave)' },
      { id: 'borehole', name: 'Borehole Temperatures' },
      { id: 'pollen', name: 'Pollen' },
      { id: 'insect', name: 'Insect Data' },
      { id: 'plant_macrofossil', name: 'Plant Macrofossils' },
    ],
  }
}, { method: 'list_data_types' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listDataTypes }

console.log('settlegrid-paleoclimate MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_data_types')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
