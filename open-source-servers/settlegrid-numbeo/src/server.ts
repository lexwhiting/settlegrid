/**
 * settlegrid-numbeo — Numbeo Cost of Living MCP Server
 *
 * Wraps the Numbeo API with SettleGrid billing.
 * No API key needed for basic endpoints.
 *
 * Methods:
 *   get_cost_of_living(city)   — Cost of living index  (1¢)
 *   get_indices(country)       — Quality of life       (1¢)
 *   get_city_prices(city)      — Item prices           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CityInput { city: string }
interface CountryInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.numbeo.com/api'
const UA = 'settlegrid-numbeo/1.0 (contact@settlegrid.ai)'

async function numbeoFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Numbeo API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'numbeo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cost_of_living: { costCents: 1, displayName: 'Cost of Living' },
      get_indices: { costCents: 1, displayName: 'Quality of Life' },
      get_city_prices: { costCents: 1, displayName: 'City Prices' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCostOfLiving = sg.wrap(async (args: CityInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (e.g. "New York")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/indices', {
    query: args.city.trim(),
  })
  return { city: args.city, data }
}, { method: 'get_cost_of_living' })

const getIndices = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "United States")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/country_indices', {
    query: args.country.trim(),
  })
  return { country: args.country, data }
}, { method: 'get_indices' })

const getCityPrices = sg.wrap(async (args: CityInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (e.g. "London")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/city_prices', {
    query: args.city.trim(),
  })
  return { city: args.city, data }
}, { method: 'get_city_prices' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCostOfLiving, getIndices, getCityPrices }

console.log('settlegrid-numbeo MCP server ready')
console.log('Methods: get_cost_of_living, get_indices, get_city_prices')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
