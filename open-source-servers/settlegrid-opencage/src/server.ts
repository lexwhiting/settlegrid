/**
 * settlegrid-opencage — OpenCage Geocoding MCP Server
 *
 * Wraps the OpenCage Geocoder API with SettleGrid billing.
 * Requires a free OpenCage API key.
 *
 * Methods:
 *   geocode(query)              — Forward geocode    (2¢)
 *   reverse_geocode(lat, lon)   — Reverse geocode    (2¢)
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

const OC_BASE = 'https://api.opencagedata.com/geocode/v1'
const API_KEY = process.env.OPENCAGE_API_KEY || ''

async function ocFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('OPENCAGE_API_KEY environment variable is required')
  const res = await fetch(`${OC_BASE}/json?${params}&key=${API_KEY}&no_annotations=0`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenCage API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opencage',
  pricing: {
    defaultCostCents: 2,
    methods: {
      geocode: { costCents: 2, displayName: 'Geocode' },
      reverse_geocode: { costCents: 2, displayName: 'Reverse Geocode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await ocFetch<{ total_results: number; results: any[] }>(`q=${q}&limit=5`)
  return {
    query: args.query,
    totalResults: data.total_results,
    results: data.results.map((r: any) => ({
      formatted: r.formatted,
      lat: r.geometry.lat,
      lng: r.geometry.lng,
      confidence: r.confidence,
      components: r.components,
      timezone: r.annotations?.timezone?.name,
      currency: r.annotations?.currency?.name,
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
  const data = await ocFetch<{ results: any[] }>(`q=${args.lat}+${args.lon}&limit=1`)
  const r = data.results[0]
  if (!r) throw new Error('No results found for these coordinates')
  return {
    lat: args.lat,
    lon: args.lon,
    formatted: r.formatted,
    components: r.components,
    timezone: r.annotations?.timezone?.name,
    currency: r.annotations?.currency?.name,
  }
}, { method: 'reverse_geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, reverseGeocode }

console.log('settlegrid-opencage MCP server ready')
console.log('Methods: geocode, reverse_geocode')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
