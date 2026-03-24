/**
 * settlegrid-geocoding-api — Geocoding API MCP Server
 *
 * Wraps Open-Meteo Geocoding API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   geocode_location(name, limit?) — geocode place (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GeoInput { name: string; limit?: number }

const API_BASE = 'https://geocoding-api.open-meteo.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'geocoding-api',
  pricing: { defaultCostCents: 1, methods: { geocode_location: { costCents: 1, displayName: 'Geocode Location' } } },
})

const geocodeLocation = sg.wrap(async (args: GeoInput) => {
  if (!args.name) throw new Error('name is required')
  const limit = args.limit ?? 5
  const data = await apiFetch<any>(`/search?name=${encodeURIComponent(args.name)}&count=${limit}&language=en`)
  return {
    results: (data.results || []).map((r: any) => ({
      name: r.name, latitude: r.latitude, longitude: r.longitude,
      country: r.country, country_code: r.country_code,
      admin1: r.admin1, admin2: r.admin2,
      elevation: r.elevation, timezone: r.timezone,
      population: r.population,
    })),
  }
}, { method: 'geocode_location' })

export { geocodeLocation }

console.log('settlegrid-geocoding-api MCP server ready')
console.log('Methods: geocode_location')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
