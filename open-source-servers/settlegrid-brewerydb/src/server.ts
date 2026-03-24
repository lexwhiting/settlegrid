/**
 * settlegrid-brewerydb — BreweryDB MCP Server
 *
 * Open brewery database with locations, types, and contact information.
 *
 * Methods:
 *   search_breweries(query)       — Search breweries by name  (1¢)
 *   get_brewery(brewery_id)       — Get brewery details by ID  (1¢)
 *   list_by_city(city)            — List breweries in a specific city  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBreweriesInput {
  query: string
}

interface GetBreweryInput {
  brewery_id: string
}

interface ListByCityInput {
  city: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openbrewerydb.org/v1/breweries'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-brewerydb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BreweryDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'brewerydb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_breweries: { costCents: 1, displayName: 'Search Breweries' },
      get_brewery: { costCents: 1, displayName: 'Get Brewery' },
      list_by_city: { costCents: 1, displayName: 'List by City' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBreweries = sg.wrap(async (args: SearchBreweriesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`?by_name=${encodeURIComponent(query)}&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    city: data.city,
    state: data.state,
    country: data.country,
    website_url: data.website_url,
  }
}, { method: 'search_breweries' })

const getBrewery = sg.wrap(async (args: GetBreweryInput) => {
  if (!args.brewery_id || typeof args.brewery_id !== 'string') throw new Error('brewery_id is required')
  const brewery_id = args.brewery_id.trim()
  const data = await apiFetch<any>(`/${encodeURIComponent(brewery_id)}`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    street: data.street,
    city: data.city,
    state: data.state,
    country: data.country,
    phone: data.phone,
    website_url: data.website_url,
  }
}, { method: 'get_brewery' })

const listByCity = sg.wrap(async (args: ListByCityInput) => {
  if (!args.city || typeof args.city !== 'string') throw new Error('city is required')
  const city = args.city.trim()
  const data = await apiFetch<any>(`?by_city=${encodeURIComponent(city)}&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    street: data.street,
    state: data.state,
    website_url: data.website_url,
  }
}, { method: 'list_by_city' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBreweries, getBrewery, listByCity }

console.log('settlegrid-brewerydb MCP server ready')
console.log('Methods: search_breweries, get_brewery, list_by_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
