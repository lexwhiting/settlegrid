/**
 * settlegrid-fao-food — FAO Food & Agriculture Data MCP Server
 *
 * Wraps the FAOSTAT API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, country?, year?)  — Get FAOSTAT data (2\u00A2)
 *   list_datasets()                     — List datasets (1\u00A2)
 *   list_countries()                    — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  country?: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.fao.org/faostat/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fao-food/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FAOSTAT API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fao-food',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get data from FAOSTAT dataset' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. QCL, FBS, TP)')
  }
  const params: Record<string, string> = { output_type: 'objects' }
  if (args.country) params.area = args.country
  if (args.year) params.year = args.year
  return apiFetch<unknown>(`/en/data/${encodeURIComponent(args.dataset)}`, params)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/en/definitions/domains')
}, { method: 'list_datasets' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/en/definitions/types/area')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, listCountries }

console.log('settlegrid-fao-food MCP server ready')
console.log('Methods: get_data, list_datasets, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
