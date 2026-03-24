/**
 * settlegrid-zillow — Zillow (Bridge API) MCP Server
 *
 * Home values and property listings via the Bridge Interactive API.
 *
 * Methods:
 *   search_properties(city, state) — Search property listings by city and state  (2¢)
 *   get_property(listing_id)      — Get details for a specific listing  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPropertiesInput {
  city: string
  state: string
}

interface GetPropertyInput {
  listing_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.bridgedataoutput.com/api/v2'
const API_KEY = process.env.BRIDGE_API_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-zillow/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Zillow (Bridge API) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'zillow',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_properties: { costCents: 2, displayName: 'Search Properties' },
      get_property: { costCents: 2, displayName: 'Get Property' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProperties = sg.wrap(async (args: SearchPropertiesInput) => {
  if (!args.city || typeof args.city !== 'string') throw new Error('city is required')
  const city = args.city.trim()
  if (!args.state || typeof args.state !== 'string') throw new Error('state is required')
  const state = args.state.trim()
  const data = await apiFetch<any>(`/OData/test/Property?$filter=City eq '${encodeURIComponent(city)}' and StateOrProvince eq '${encodeURIComponent(state)}'&$top=10`)
  const items = (data.value ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        ListingId: item.ListingId,
        ListPrice: item.ListPrice,
        City: item.City,
        StateOrProvince: item.StateOrProvince,
        BedroomsTotal: item.BedroomsTotal,
        BathroomsTotalInteger: item.BathroomsTotalInteger,
        LivingArea: item.LivingArea,
    })),
  }
}, { method: 'search_properties' })

const getProperty = sg.wrap(async (args: GetPropertyInput) => {
  if (!args.listing_id || typeof args.listing_id !== 'string') throw new Error('listing_id is required')
  const listing_id = args.listing_id.trim()
  const data = await apiFetch<any>(`/OData/test/Property('${encodeURIComponent(listing_id)}')`)
  return {
    ListingId: data.ListingId,
    ListPrice: data.ListPrice,
    City: data.City,
    StateOrProvince: data.StateOrProvince,
    BedroomsTotal: data.BedroomsTotal,
    BathroomsTotalInteger: data.BathroomsTotalInteger,
    LivingArea: data.LivingArea,
    LotSizeArea: data.LotSizeArea,
    YearBuilt: data.YearBuilt,
  }
}, { method: 'get_property' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProperties, getProperty }

console.log('settlegrid-zillow MCP server ready')
console.log('Methods: search_properties, get_property')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
