/**
 * settlegrid-unicef — UNICEF Child Welfare Data MCP Server
 *
 * Wraps the UNICEF SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_indicators(query)          — Search indicators (1\u00A2)
 *   get_data(indicator, country?)     — Get data (2\u00A2)
 *   list_datasets()                   — List datasets (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface GetDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.data.unicef.org/ws/public/sdmxapi/rest'

async function apiFetch<T>(path: string, accept = 'application/json'): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'settlegrid-unicef/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UNICEF API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unicef',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_indicators: { costCents: 1, displayName: 'Search UNICEF indicators' },
      get_data: { costCents: 2, displayName: 'Get data for indicator and country' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(`/codelist/UNICEF/CL_INDICATOR/latest?format=sdmx-json&detail=full`)
}, { method: 'search_indicators' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. GLOBAL_DATAFLOW)')
  }
  const key = args.country ? `${args.country.toUpperCase()}.` : ''
  return apiFetch<unknown>(`/data/UNICEF,${encodeURIComponent(args.indicator)},1.0/${key}?format=sdmx-json&lastNObservations=10`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/UNICEF?format=sdmx-json')
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIndicators, getData, listDatasets }

console.log('settlegrid-unicef MCP server ready')
console.log('Methods: search_indicators, get_data, list_datasets')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
