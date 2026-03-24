/**
 * settlegrid-nominatim — OpenStreetMap Nominatim MCP Server
 *
 * Wraps the OpenStreetMap Nominatim API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search(q)                                (1¢)
 *   reverse(lat, lon)                        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  limit?: number
}

interface ReverseInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'settlegrid-nominatim/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`OpenStreetMap Nominatim API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nominatim',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 1, displayName: 'Geocode an address or place name' },
      reverse: { costCents: 1, displayName: 'Reverse geocode coordinates to address' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (address or place name)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { q: args.q, count: items.length, results: items }
}, { method: 'search' })

const reverse = sg.wrap(async (args: ReverseInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lon !== 'number' || isNaN(args.lon)) {
    throw new Error('lon must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lon'] = String(args.lon)

  const data = await apiFetch<Record<string, unknown>>('/reverse', {
    params,
  })

  return data
}, { method: 'reverse' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, reverse }

console.log('settlegrid-nominatim MCP server ready')
console.log('Methods: search, reverse')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
