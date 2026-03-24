/**
 * settlegrid-bis-banking — Bank for Intl Settlements Data MCP Server
 *
 * Wraps the BIS SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, key?)   — Get BIS data (2\u00A2)
 *   list_datasets()           — List datasets (1\u00A2)
 *   search_data(query)        — Search data (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  key?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.bis.org/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-bis-banking/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BIS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bis-banking',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get BIS dataset data' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
      search_data: { costCents: 1, displayName: 'Search BIS data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. WS_CBPOL_D, WS_XRU_D)')
  }
  const key = args.key || 'all'
  return apiFetch<unknown>(`/data/BIS,${encodeURIComponent(args.dataset)},1.0/${encodeURIComponent(key)}?lastNObservations=20`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/BIS?detail=allstubs')
}, { method: 'list_datasets' })

const searchData = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/dataflow/BIS?detail=full')
}, { method: 'search_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, searchData }

console.log('settlegrid-bis-banking MCP server ready')
console.log('Methods: get_data, list_datasets, search_data')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
