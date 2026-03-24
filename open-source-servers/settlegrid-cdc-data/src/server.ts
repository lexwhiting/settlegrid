/**
 * settlegrid-cdc-data — CDC Data MCP Server
 *
 * US CDC health statistics and surveillance data via SODA API.
 *
 * Methods:
 *   search_datasets(query)        — Search CDC datasets by keyword  (1¢)
 *   query_dataset(dataset_id, query) — Query a specific CDC dataset  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface QueryDatasetInput {
  dataset_id: string
  query?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.cdc.gov/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-cdc-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CDC Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'cdc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      query_dataset: { costCents: 1, displayName: 'Query Dataset' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/catalog/v1?q=${encodeURIComponent(query)}&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        resource.id: item.resource.id,
        resource.name: item.resource.name,
        resource.description: item.resource.description,
    })),
  }
}, { method: 'search_datasets' })

const queryDataset = sg.wrap(async (args: QueryDatasetInput) => {
  if (!args.dataset_id || typeof args.dataset_id !== 'string') throw new Error('dataset_id is required')
  const dataset_id = args.dataset_id.trim()
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const data = await apiFetch<any>(`/id/${encodeURIComponent(dataset_id)}.json?$limit=10`)
  return data
}, { method: 'query_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, queryDataset }

console.log('settlegrid-cdc-data MCP server ready')
console.log('Methods: search_datasets, query_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
