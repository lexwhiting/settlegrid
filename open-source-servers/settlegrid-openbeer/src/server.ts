/**
 * settlegrid-openbeer — OpenBeer MCP Server
 *
 * Beer and brewery discovery using the Open Brewery DB dataset.
 *
 * Methods:
 *   search_by_type(type)          — Search breweries by type (micro, nano, brewpub, etc.)  (1¢)
 *   search_by_state(state)        — Search breweries by US state  (1¢)
 *   random_breweries()            — Get random breweries  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchByTypeInput {
  type: string
}

interface SearchByStateInput {
  state: string
}

interface RandomBreweriesInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openbrewerydb.org/v1/breweries'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-openbeer/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenBeer API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openbeer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_by_type: { costCents: 1, displayName: 'Search by Type' },
      search_by_state: { costCents: 1, displayName: 'Search by State' },
      random_breweries: { costCents: 1, displayName: 'Random Breweries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchByType = sg.wrap(async (args: SearchByTypeInput) => {
  if (!args.type || typeof args.type !== 'string') throw new Error('type is required')
  const type = args.type.trim()
  const data = await apiFetch<any>(`?by_type=${encodeURIComponent(type)}&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    city: data.city,
    state: data.state,
    country: data.country,
  }
}, { method: 'search_by_type' })

const searchByState = sg.wrap(async (args: SearchByStateInput) => {
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`?by_state=${encodeURIComponent(state)}&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    city: data.city,
    website_url: data.website_url,
  }
}, { method: 'search_by_state' })

const randomBreweries = sg.wrap(async (args: RandomBreweriesInput) => {

  const data = await apiFetch<any>(`/../random?size=5`)
  return {
    id: data.id,
    name: data.name,
    brewery_type: data.brewery_type,
    city: data.city,
    state: data.state,
    country: data.country,
  }
}, { method: 'random_breweries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchByType, searchByState, randomBreweries }

console.log('settlegrid-openbeer MCP server ready')
console.log('Methods: search_by_type, search_by_state, random_breweries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
