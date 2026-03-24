/**
 * settlegrid-healthdata-gov — HealthData.gov MCP Server
 *
 * US federal health datasets from HealthData.gov CKAN catalog.
 *
 * Methods:
 *   search_datasets(query)        — Search US health datasets by keyword  (1¢)
 *   get_dataset(dataset_id)       — Get dataset details by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface GetDatasetInput {
  dataset_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://healthdata.gov/api/3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-healthdata-gov/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HealthData.gov API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'healthdata-gov',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/action/package_search?q=${encodeURIComponent(query)}&rows=10`)
  const items = (data.result.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        notes: item.notes,
        organization: item.organization,
    })),
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.dataset_id || typeof args.dataset_id !== 'string') throw new Error('dataset_id is required')
  const dataset_id = args.dataset_id.trim()
  const data = await apiFetch<any>(`/action/package_show?id=${encodeURIComponent(dataset_id)}`)
  return {
    id: data.id,
    title: data.title,
    notes: data.notes,
    resources: data.resources,
    organization: data.organization,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-healthdata-gov MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
