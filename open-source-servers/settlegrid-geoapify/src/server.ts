/**
 * settlegrid-geoapify — Geoapify Geocoding & Places MCP Server
 *
 * Wraps the Geoapify API with SettleGrid billing.
 * Requires a free Geoapify API key.
 *
 * Methods:
 *   geocode(text)                         — Forward geocode    (2¢)
 *   search_places(categories, lat, lon)   — Search POIs        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  text: string
}

interface PlacesInput {
  categories: string
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GEO_BASE = 'https://api.geoapify.com/v1'
const API_KEY = process.env.GEOAPIFY_API_KEY || ''

async function geoFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('GEOAPIFY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${GEO_BASE}${path}${sep}apiKey=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Geoapify API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'geoapify',
  pricing: {
    defaultCostCents: 2,
    methods: {
      geocode: { costCents: 2, displayName: 'Geocode' },
      search_places: { costCents: 2, displayName: 'Search Places' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required')
  }
  const t = encodeURIComponent(args.text)
  const data = await geoFetch<{ features: any[] }>(`/geocode/search?text=${t}&limit=5`)
  return {
    query: args.text,
    results: (data.features || []).map((f: any) => ({
      formatted: f.properties?.formatted,
      lat: f.properties?.lat,
      lon: f.properties?.lon,
      country: f.properties?.country,
      city: f.properties?.city,
      state: f.properties?.state,
      postcode: f.properties?.postcode,
      resultType: f.properties?.result_type,
    })),
  }
}, { method: 'geocode' })

const searchPlaces = sg.wrap(async (args: PlacesInput) => {
  if (!args.categories || typeof args.categories !== 'string') {
    throw new Error('categories is required (e.g. "catering.restaurant")')
  }
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const cats = encodeURIComponent(args.categories)
  const data = await geoFetch<{ features: any[] }>(
    `/places?categories=${cats}&filter=circle:${args.lon},${args.lat},5000&limit=20`
  )
  return {
    categories: args.categories,
    center: { lat: args.lat, lon: args.lon },
    places: (data.features || []).map((f: any) => ({
      name: f.properties?.name,
      categories: f.properties?.categories,
      lat: f.properties?.lat,
      lon: f.properties?.lon,
      address: f.properties?.formatted,
      distance: f.properties?.distance,
    })),
  }
}, { method: 'search_places' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, searchPlaces }

console.log('settlegrid-geoapify MCP server ready')
console.log('Methods: geocode, search_places')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
