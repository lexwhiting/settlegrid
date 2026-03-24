/**
 * settlegrid-brewery-data — Brewery Data MCP Server
 *
 * Wraps Open Brewery DB API with SettleGrid billing.
 * No API key needed — fully open.
 *
 * Methods:
 *   search_breweries(query, limit?) — search breweries (1¢)
 *   get_brewery(id) — get brewery by ID (1¢)
 *   breweries_by_city(city, limit?) — breweries in city (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface BreweryInput { id: string }
interface CityInput { city: string; limit?: number }

const API_BASE = 'https://api.openbrewerydb.org/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'brewery-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_breweries: { costCents: 1, displayName: 'Search Breweries' },
      get_brewery: { costCents: 1, displayName: 'Get Brewery' },
      breweries_by_city: { costCents: 1, displayName: 'Breweries By City' },
    },
  },
})

const searchBreweries = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(`/breweries/search?query=${encodeURIComponent(args.query)}&per_page=${limit}`)
  return {
    breweries: data.map((b: any) => ({
      id: b.id, name: b.name, type: b.brewery_type,
      city: b.city, state: b.state, country: b.country,
      phone: b.phone, website: b.website_url,
      lat: b.latitude, lon: b.longitude,
    })),
  }
}, { method: 'search_breweries' })

const getBrewery = sg.wrap(async (args: BreweryInput) => {
  if (!args.id) throw new Error('id is required')
  const b = await apiFetch<any>(`/breweries/${args.id}`)
  return {
    id: b.id, name: b.name, type: b.brewery_type,
    address: `${b.address_1 || ''} ${b.address_2 || ''}`.trim(),
    city: b.city, state: b.state, country: b.country, postal: b.postal_code,
    phone: b.phone, website: b.website_url, lat: b.latitude, lon: b.longitude,
  }
}, { method: 'get_brewery' })

const breweriesByCity = sg.wrap(async (args: CityInput) => {
  if (!args.city) throw new Error('city is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(`/breweries?by_city=${encodeURIComponent(args.city)}&per_page=${limit}`)
  return {
    city: args.city,
    breweries: data.map((b: any) => ({
      id: b.id, name: b.name, type: b.brewery_type, website: b.website_url,
    })),
  }
}, { method: 'breweries_by_city' })

export { searchBreweries, getBrewery, breweriesByCity }

console.log('settlegrid-brewery-data MCP server ready')
console.log('Methods: search_breweries, get_brewery, breweries_by_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
