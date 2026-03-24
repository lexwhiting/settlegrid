/**
 * settlegrid-geonames — GeoNames Geographic Data MCP Server
 *
 * Wraps the GeoNames API with SettleGrid billing.
 * Requires a free GeoNames username.
 *
 * Methods:
 *   search_places(query, max_rows)  — Search places     (1¢)
 *   get_nearby(lat, lon)            — Nearby places     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  max_rows?: number
}

interface NearbyInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GN_BASE = 'https://api.geonames.org'
const USERNAME = process.env.GEONAMES_USERNAME || ''

async function gnFetch<T>(path: string): Promise<T> {
  if (!USERNAME) throw new Error('GEONAMES_USERNAME environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${GN_BASE}${path}${sep}username=${USERNAME}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GeoNames API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'geonames',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_places: { costCents: 1, displayName: 'Search Places' },
      get_nearby: { costCents: 1, displayName: 'Get Nearby' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlaces = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const maxRows = Math.min(Math.max(args.max_rows ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await gnFetch<{ totalResultsCount: number; geonames: any[] }>(
    `/searchJSON?q=${q}&maxRows=${maxRows}`
  )
  return {
    query: args.query,
    totalResults: data.totalResultsCount,
    places: (data.geonames || []).map((g: any) => ({
      geonameId: g.geonameId,
      name: g.name,
      countryName: g.countryName,
      countryCode: g.countryCode,
      lat: parseFloat(g.lat),
      lng: parseFloat(g.lng),
      population: g.population,
      featureClass: g.fcl,
      featureCode: g.fcode,
    })),
  }
}, { method: 'search_places' })

const getNearby = sg.wrap(async (args: NearbyInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await gnFetch<{ geonames: any[] }>(
    `/findNearbyJSON?lat=${args.lat}&lng=${args.lon}&maxRows=10`
  )
  return {
    lat: args.lat,
    lon: args.lon,
    places: (data.geonames || []).map((g: any) => ({
      geonameId: g.geonameId,
      name: g.name,
      distance: g.distance,
      countryName: g.countryName,
      lat: parseFloat(g.lat),
      lng: parseFloat(g.lng),
    })),
  }
}, { method: 'get_nearby' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlaces, getNearby }

console.log('settlegrid-geonames MCP server ready')
console.log('Methods: search_places, get_nearby')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
