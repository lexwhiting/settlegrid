/**
 * settlegrid-un-refugees — UNHCR Refugee Data MCP Server
 *
 * Wraps the UNHCR Population API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_refugee_data(country, year?)  — Get refugee data (2\u00A2)
 *   list_countries()                  — List countries (1\u00A2)
 *   get_demographics(country)         — Get demographics (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RefugeeDataInput {
  country: string
  year?: string
}

interface DemographicsInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.unhcr.org/population/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-un-refugees/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UNHCR API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-refugees',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_refugee_data: { costCents: 2, displayName: 'Get refugee data for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with refugee data' },
      get_demographics: { costCents: 2, displayName: 'Get demographic breakdown' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRefugeeData = sg.wrap(async (args: RefugeeDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code, e.g. SYR)')
  }
  const params: Record<string, string> = { limit: '100', coo: args.country.toUpperCase() }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/population/', params)
}, { method: 'get_refugee_data' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries/')
}, { method: 'list_countries' })

const getDemographics = sg.wrap(async (args: DemographicsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code)')
  }
  return apiFetch<unknown>('/demographics/', { coo: args.country.toUpperCase(), limit: '100' })
}, { method: 'get_demographics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRefugeeData, listCountries, getDemographics }

console.log('settlegrid-un-refugees MCP server ready')
console.log('Methods: get_refugee_data, list_countries, get_demographics')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
