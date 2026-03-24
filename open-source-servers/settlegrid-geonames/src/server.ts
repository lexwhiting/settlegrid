/**
 * settlegrid-geonames — GeoNames MCP Server
 *
 * Wraps the GeoNames API with SettleGrid billing.
 * Requires GEONAMES_USERNAME environment variable.
 *
 * Methods:
 *   search(q)                                (1¢)
 *   get_nearby(lat, lng)                     (1¢)
 *   get_timezone(lat, lng)                   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  q: string
  maxRows?: number
}

interface GetNearbyInput {
  lat: number
  lng: number
}

interface GetTimezoneInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://api.geonames.org'
const USER_AGENT = 'settlegrid-geonames/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GEONAMES_USERNAME
  if (!key) throw new Error('GEONAMES_USERNAME environment variable is required')
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
  url.searchParams.set('username', getApiKey())
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
      search: { costCents: 1, displayName: 'Search for place names' },
      get_nearby: { costCents: 1, displayName: 'Find nearby places by coordinates' },
      get_timezone: { costCents: 1, displayName: 'Get timezone for coordinates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (place name query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.maxRows !== undefined) params['maxRows'] = String(args.maxRows)

  const data = await apiFetch<Record<string, unknown>>('/searchJSON', {
    params,
  })

  return data
}, { method: 'search' })

const getNearby = sg.wrap(async (args: GetNearbyInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)

  const data = await apiFetch<Record<string, unknown>>('/findNearbyPlaceNameJSON', {
    params,
  })

  return data
}, { method: 'get_nearby' })

const getTimezone = sg.wrap(async (args: GetTimezoneInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)

  const data = await apiFetch<Record<string, unknown>>('/timezoneJSON', {
    params,
  })

  return data
}, { method: 'get_timezone' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getNearby, getTimezone }

console.log('settlegrid-geonames MCP server ready')
console.log('Methods: search, get_nearby, get_timezone')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
