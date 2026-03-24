/**
 * settlegrid-nasdaq-data — Nasdaq Data Link MCP Server
 *
 * Wraps the Nasdaq Data Link API with SettleGrid billing.
 * Requires NASDAQ_API_KEY environment variable.
 *
 * Methods:
 *   get_dataset(database_code, dataset_code) (2¢)
 *   search_datasets(query)                   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDatasetInput {
  database_code: string
  dataset_code: string
  limit?: number
}

interface SearchDatasetsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.nasdaq.com/api/v3'
const USER_AGENT = 'settlegrid-nasdaq-data/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.NASDAQ_API_KEY
  if (!key) throw new Error('NASDAQ_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('api_key', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Nasdaq Data Link API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nasdaq-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dataset: { costCents: 2, displayName: 'Get a dataset by code' },
      search_datasets: { costCents: 1, displayName: 'Search for datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.database_code || typeof args.database_code !== 'string') {
    throw new Error('database_code is required (database code (e.g. wiki, fred))')
  }
  if (!args.dataset_code || typeof args.dataset_code !== 'string') {
    throw new Error('dataset_code is required (dataset code (e.g. aapl, gdp))')
  }

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>(`/datasets/${encodeURIComponent(String(args.database_code))}/${encodeURIComponent(String(args.dataset_code))}.json`, {
    params,
  })

  return data
}, { method: 'get_dataset' })

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search query)')
  }

  const params: Record<string, string> = {}
  params['query'] = args.query

  const data = await apiFetch<Record<string, unknown>>('/datasets.json', {
    params,
  })

  return data
}, { method: 'search_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDataset, searchDatasets }

console.log('settlegrid-nasdaq-data MCP server ready')
console.log('Methods: get_dataset, search_datasets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
