/**
 * settlegrid-healthcare-gov — Healthcare.gov MCP Server
 *
 * US Healthcare.gov glossary, articles, and marketplace information.
 *
 * Methods:
 *   search_datasets(query)        — Search Healthcare.gov datasets  (1¢)
 *   get_dataset(dataset_id)       — Get a specific Healthcare.gov dataset  (1¢)
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

const BASE = 'https://data.healthcare.gov/api'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-healthcare-gov/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Healthcare.gov API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'healthcare-gov',
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
  const data = await apiFetch<any>(`/3/action/package_search?q=${encodeURIComponent(query)}&rows=10`)
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
  const data = await apiFetch<any>(`/3/action/package_show?id=${encodeURIComponent(dataset_id)}`)
  return {
    id: data.id,
    title: data.title,
    notes: data.notes,
    resources: data.resources,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-healthcare-gov MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
