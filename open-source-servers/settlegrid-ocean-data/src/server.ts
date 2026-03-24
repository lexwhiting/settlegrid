/**
 * settlegrid-ocean-data — ERDDAP Ocean Data MCP Server
 *
 * Ocean and coastal data from NOAA CoastWatch ERDDAP.
 *
 * Methods:
 *   search_datasets(query)        — Search ocean datasets by keyword  (1¢)
 *   get_dataset_info(dataset_id)  — Get metadata for a specific dataset  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface GetDatasetInfoInput {
  dataset_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://coastwatch.pfeg.noaa.gov/erddap'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ocean-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ERDDAP Ocean Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ocean-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_dataset_info: { costCents: 1, displayName: 'Get Dataset Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search/index.json?page=1&itemsPerPage=10&searchFor=${encodeURIComponent(query)}`)
  const items = (data.table.rows ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        griddap: item.griddap,
        title: item.title,
        summary: item.summary,
    })),
  }
}, { method: 'search_datasets' })

const getDatasetInfo = sg.wrap(async (args: GetDatasetInfoInput) => {
  if (!args.dataset_id || typeof args.dataset_id !== 'string') throw new Error('dataset_id is required')
  const dataset_id = args.dataset_id.trim()
  const data = await apiFetch<any>(`/info/${encodeURIComponent(dataset_id)}/index.json`)
  const items = (data.table.rows ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Row Type: item.Row Type,
        Variable Name: item.Variable Name,
        Attribute Name: item.Attribute Name,
        Value: item.Value,
    })),
  }
}, { method: 'get_dataset_info' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDatasetInfo }

console.log('settlegrid-ocean-data MCP server ready')
console.log('Methods: search_datasets, get_dataset_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
