/**
 * settlegrid-un-population — UN Population Data MCP Server
 *
 * Wraps the UN Data Portal API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_population(country, year?)  — Get population data (2\u00A2)
 *   list_indicators()               — List indicators (1\u00A2)
 *   list_locations()                 — List locations (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PopulationInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://population.un.org/dataportalapi/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-un-population/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UN Population API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-population',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_population: { costCents: 2, displayName: 'Get population data for a country' },
      list_indicators: { costCents: 1, displayName: 'List available population indicators' },
      list_locations: { costCents: 1, displayName: 'List available locations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPopulation = sg.wrap(async (args: PopulationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3166 numeric code or name)')
  }
  const params: Record<string, string> = { locationId: args.country, indicatorIds: '49' }
  if (args.year) params.startYear = args.year
  if (args.year) params.endYear = args.year
  return apiFetch<unknown>('/data/indicators/49/locations/' + encodeURIComponent(args.country), params)
}, { method: 'get_population' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listLocations = sg.wrap(async () => {
  return apiFetch<unknown>('/locations')
}, { method: 'list_locations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPopulation, listIndicators, listLocations }

console.log('settlegrid-un-population MCP server ready')
console.log('Methods: get_population, list_indicators, list_locations')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
