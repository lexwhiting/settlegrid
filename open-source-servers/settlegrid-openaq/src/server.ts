/**
 * settlegrid-openaq — OpenAQ MCP Server
 *
 * Global air quality measurements from thousands of monitoring stations.
 *
 * Methods:
 *   get_latest(city, country)     — Get latest air quality measurements by city or country  (1¢)
 *   get_locations(city, country)  — Search air quality monitoring locations  (1¢)
 *   get_measurements(location_id) — Get air quality measurements for a location  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  city?: string
  country?: string
}

interface GetLocationsInput {
  city?: string
  country?: string
}

interface GetMeasurementsInput {
  location_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openaq.org/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-openaq/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAQ API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openaq',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get Latest' },
      get_locations: { costCents: 1, displayName: 'Get Locations' },
      get_measurements: { costCents: 1, displayName: 'Get Measurements' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {
  const city = typeof args.city === 'string' ? args.city.trim() : ''
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const data = await apiFetch<any>(`/latest?limit=10&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
  const items = (data.results ?? []).slice(0, 10)
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
  const city = typeof args.city === 'string' ? args.city.trim() : ''
  const country = typeof args.country === 'string' ? args.country.trim() : ''
  const data = await apiFetch<any>(`/locations?limit=10&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        country: item.country,
        parameters: item.parameters,
    })),
  }
}, { method: 'get_locations' })

const getMeasurements = sg.wrap(async (args: GetMeasurementsInput) => {
  if (typeof args.location_id !== 'number') throw new Error('location_id is required and must be a number')
  const location_id = args.location_id
  const data = await apiFetch<any>(`/measurements?location_id=${location_id}&limit=20`)
  const items = (data.results ?? []).slice(0, 20)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        parameter: item.parameter,
        value: item.value,
        unit: item.unit,
        date: item.date,
    })),
  }
}, { method: 'get_measurements' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getLocations, getMeasurements }

console.log('settlegrid-openaq MCP server ready')
console.log('Methods: get_latest, get_locations, get_measurements')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
