/**
 * settlegrid-ilo-labor — ILO Labor Statistics MCP Server
 *
 * Wraps the ILO SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_indicators(query)        — Search indicators (1\u00A2)
 *   get_data(indicator, country?)   — Get data (2\u00A2)
 *   list_datasets()                 — List datasets (1\u00A2)
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

const API_BASE = 'https://www.ilo.org/sdmx/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-ilo-labor/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ILO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ilo-labor',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_indicators: { costCents: 1, displayName: 'Search ILO indicators' },
      get_data: { costCents: 2, displayName: 'Get data for an indicator' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(`/dataflow/ILO?detail=allstubs&references=none`)
}, { method: 'search_indicators' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (ILO dataflow ID)')
  }
  const key = args.country ? `${args.country.toUpperCase()}` : 'all'
  return apiFetch<unknown>(`/data/ILO,${encodeURIComponent(args.indicator)},1.0/${key}?lastNObservations=10`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/ILO?detail=allstubs')
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIndicators, getData, listDatasets }

console.log('settlegrid-ilo-labor MCP server ready')
console.log('Methods: search_indicators, get_data, list_datasets')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
