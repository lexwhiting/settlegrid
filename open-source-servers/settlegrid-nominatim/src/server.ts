/**
 * settlegrid-nominatim — OpenStreetMap Geocoding MCP Server
 *
 * Wraps the Nominatim API with SettleGrid billing.
 * No API key needed. Max 1 req/s.
 *
 * Methods:
 *   geocode(query)              — Address to coordinates   (1¢)
 *   reverse_geocode(lat, lon)   — Coordinates to address   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  query: string
}

interface ReverseInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOM_BASE = 'https://nominatim.openstreetmap.org'

async function nomFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${NOM_BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-nominatim/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Nominatim API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nominatim',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Geocode' },
      reverse_geocode: { costCents: 1, displayName: 'Reverse Geocode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await nomFetch<any[]>(`/search?q=${q}&format=json&limit=5&addressdetails=1`)
  if (data.length === 0) return { query: args.query, results: [] }
  return {
    query: args.query,
    results: data.map((r: any) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      type: r.type,
      importance: r.importance,
      address: r.address,
    })),
  }
}, { method: 'geocode' })

const reverseGeocode = sg.wrap(async (args: ReverseInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await nomFetch<any>(
    `/reverse?lat=${args.lat}&lon=${args.lon}&format=json&addressdetails=1`
  )
  return {
    lat: args.lat,
    lon: args.lon,
    displayName: data.display_name,
    address: data.address,
    type: data.type,
  }
}, { method: 'reverse_geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, reverseGeocode }

console.log('settlegrid-nominatim MCP server ready')
console.log('Methods: geocode, reverse_geocode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
