/**
 * settlegrid-who-gho — WHO Global Health Observatory MCP Server
 *
 * Wraps the WHO GHO OData API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(code, country?)  — Get indicator data (2\u00A2)
 *   search_indicators(query)       — Search indicators (1\u00A2)
 *   list_countries()               — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  code: string
  country?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ghoapi.azureedge.net/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-who-gho/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WHO GHO API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'who-gho',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get GHO indicator data' },
      search_indicators: { costCents: 1, displayName: 'Search GHO indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required (GHO indicator code, e.g. WHOSIS_000001)')
  }
  const filter = args.country
    ? `?$filter=SpatialDim eq '${args.country.toUpperCase()}'`
    : ''
  return apiFetch<unknown>(`/${encodeURIComponent(args.code)}${filter}`)
}, { method: 'get_indicator' })

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(`/Indicator?$filter=contains(IndicatorName,'${encodeURIComponent(args.query)}')`)
}, { method: 'search_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/DIMENSION/COUNTRY/DimensionValues')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, searchIndicators, listCountries }

console.log('settlegrid-who-gho MCP server ready')
console.log('Methods: get_indicator, search_indicators, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
