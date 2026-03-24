/**
 * settlegrid-openrouteservice — Routing & Directions MCP Server
 *
 * Wraps the OpenRouteService API with SettleGrid billing.
 * Requires a free ORS API key.
 *
 * Methods:
 *   get_directions(start, end, profile)  — Route directions   (2¢)
 *   geocode_search(query)                — Geocode search     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DirectionsInput {
  start_lon: number
  start_lat: number
  end_lon: number
  end_lat: number
  profile?: string
}

interface GeocodeInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ORS_BASE = 'https://api.openrouteservice.org'
const API_KEY = process.env.ORS_API_KEY || ''
const VALID_PROFILES = new Set(['driving-car', 'cycling-regular', 'foot-walking'])

async function orsFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_KEY) throw new Error('ORS_API_KEY environment variable is required')
  const res = await fetch(`${ORS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ORS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openrouteservice',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_directions: { costCents: 2, displayName: 'Get Directions' },
      geocode_search: { costCents: 2, displayName: 'Geocode Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDirections = sg.wrap(async (args: DirectionsInput) => {
  if (typeof args.start_lon !== 'number' || typeof args.start_lat !== 'number' ||
      typeof args.end_lon !== 'number' || typeof args.end_lat !== 'number') {
    throw new Error('start_lon, start_lat, end_lon, end_lat are all required numbers')
  }
  const profile = args.profile && VALID_PROFILES.has(args.profile) ? args.profile : 'driving-car'
  const data = await orsFetch<any>(`/v2/directions/${profile}/geojson`, {
    method: 'POST',
    body: JSON.stringify({
      coordinates: [[args.start_lon, args.start_lat], [args.end_lon, args.end_lat]],
    }),
  })
  const route = data.features?.[0]?.properties?.summary
  return {
    profile,
    distance: route?.distance,
    distanceKm: route?.distance ? (route.distance / 1000).toFixed(2) : null,
    duration: route?.duration,
    durationMin: route?.duration ? (route.duration / 60).toFixed(1) : null,
    steps: data.features?.[0]?.properties?.segments?.[0]?.steps?.map((s: any) => ({
      instruction: s.instruction,
      distance: s.distance,
      duration: s.duration,
    })) || [],
  }
}, { method: 'get_directions' })

const geocodeSearch = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await orsFetch<{ features: any[] }>(
    `/geocode/search?text=${q}&size=5`
  )
  return {
    query: args.query,
    results: (data.features || []).map((f: any) => ({
      name: f.properties?.name,
      label: f.properties?.label,
      country: f.properties?.country,
      region: f.properties?.region,
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
      confidence: f.properties?.confidence,
    })),
  }
}, { method: 'geocode_search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDirections, geocodeSearch }

console.log('settlegrid-openrouteservice MCP server ready')
console.log('Methods: get_directions, geocode_search')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
