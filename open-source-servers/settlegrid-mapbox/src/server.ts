/**
 * settlegrid-mapbox — Mapbox MCP Server
 *
 * Wraps the Mapbox API with SettleGrid billing.
 * Requires MAPBOX_TOKEN environment variable.
 *
 * Methods:
 *   geocode(query)                           (1¢)
 *   get_directions(coordinates)              (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  query: string
  limit?: number
}

interface GetDirectionsInput {
  coordinates: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.mapbox.com'
const USER_AGENT = 'settlegrid-mapbox/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.MAPBOX_TOKEN
  if (!key) throw new Error('MAPBOX_TOKEN environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('access_token', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mapbox API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mapbox',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Forward geocode an address' },
      get_directions: { costCents: 2, displayName: 'Get driving directions between points' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (address or place name)')
  }

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>(`/geocoding/v5/mapbox.places/${encodeURIComponent(String(args.query))}.json`, {
    params,
  })

  return data
}, { method: 'geocode' })

const getDirections = sg.wrap(async (args: GetDirectionsInput) => {
  if (!args.coordinates || typeof args.coordinates !== 'string') {
    throw new Error('coordinates is required (semicolon-separated lon,lat pairs)')
  }

  const params: Record<string, string> = {}
  params['coordinates'] = String(args.coordinates)

  const data = await apiFetch<Record<string, unknown>>(`/directions/v5/mapbox/driving/${encodeURIComponent(String(args.coordinates))}`, {
    params,
  })

  return data
}, { method: 'get_directions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, getDirections }

console.log('settlegrid-mapbox MCP server ready')
console.log('Methods: geocode, get_directions')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
