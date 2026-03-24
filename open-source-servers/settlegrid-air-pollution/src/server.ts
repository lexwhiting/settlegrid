/**
 * settlegrid-air-pollution — OpenAQ Air Pollution MCP Server
 *
 * Global air quality measurements from OpenAQ monitoring network.
 *
 * Methods:
 *   get_latest(country)           — Get latest air quality measurements by country  (1¢)
 *   get_locations(city)           — Search monitoring locations by city name  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  country: string
}

interface GetLocationsInput {
  city: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openaq.org/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-air-pollution/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAQ Air Pollution API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'air-pollution',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get Latest' },
      get_locations: { costCents: 1, displayName: 'Get Locations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  const data = await apiFetch<any>(`/latest?country=${encodeURIComponent(country)}&limit=15&order_by=lastUpdated&sort=desc`)
  const items = (data.results ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        location: item.location,
        city: item.city,
        country: item.country,
        measurements: item.measurements,
    })),
  }
}, { method: 'get_latest' })

const getLocations = sg.wrap(async (args: GetLocationsInput) => {
  if (!args.city || typeof args.city !== 'string') throw new Error('city is required')
  const city = args.city.trim()
  const data = await apiFetch<any>(`/locations?city=${encodeURIComponent(city)}&limit=15&order_by=lastUpdated&sort=desc`)
  const items = (data.results ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        country: item.country,
        parameters: item.parameters,
        lastUpdated: item.lastUpdated,
        coordinates: item.coordinates,
    })),
  }
}, { method: 'get_locations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getLocations }

console.log('settlegrid-air-pollution MCP server ready')
console.log('Methods: get_latest, get_locations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
