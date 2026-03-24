/**
 * settlegrid-data-gov — Data.gov MCP Server
 *
 * Search and access US government open datasets.
 *
 * Methods:
 *   search_datasets(query, rows)  — Search data.gov datasets by keyword  (1¢)
 *   get_dataset(id)               — Get metadata for a specific dataset by ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  rows?: number
}

interface GetDatasetInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://catalog.data.gov/api/3'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-data-gov/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Data.gov API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'data-gov',
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
  const rows = typeof args.rows === 'number' ? args.rows : 0
  const data = await apiFetch<any>(`/action/package_search?q=${encodeURIComponent(query)}&rows=${rows}`)
  const items = (data.result.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        name: item.name,
        title: item.title,
        notes: item.notes,
        organization: item.organization,
        resources: item.resources,
    })),
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/action/package_show?id=${encodeURIComponent(id)}`)
  return {
    result: data.result,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-data-gov MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
