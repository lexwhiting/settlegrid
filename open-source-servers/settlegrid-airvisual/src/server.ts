/**
 * settlegrid-airvisual — IQAir AirVisual MCP Server
 *
 * Wraps the IQAir AirVisual API with SettleGrid billing.
 * Requires AIRVISUAL_API_KEY environment variable.
 *
 * Methods:
 *   get_city(city, state, country)           (1¢)
 *   get_nearest(lat, lon)                    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCityInput {
  city: string
  state: string
  country: string
}

interface GetNearestInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.airvisual.com/v2'
const USER_AGENT = 'settlegrid-airvisual/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.AIRVISUAL_API_KEY
  if (!key) throw new Error('AIRVISUAL_API_KEY environment variable is required')
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
  url.searchParams.set('key', getApiKey())
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
    throw new Error(`IQAir AirVisual API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'airvisual',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_city: { costCents: 1, displayName: 'Get air quality for a specific city' },
      get_nearest: { costCents: 1, displayName: 'Get air quality for nearest station by coordinates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCity = sg.wrap(async (args: GetCityInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (city name)')
  }
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (state name)')
  }
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (country name)')
  }

  const params: Record<string, string> = {}
  params['city'] = args.city
  params['state'] = args.state
  params['country'] = args.country

  const data = await apiFetch<Record<string, unknown>>('/city', {
    params,
  })

  return data
}, { method: 'get_city' })

const getNearest = sg.wrap(async (args: GetNearestInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lon !== 'number' || isNaN(args.lon)) {
    throw new Error('lon must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lon'] = String(args.lon)

  const data = await apiFetch<Record<string, unknown>>('/nearest_city', {
    params,
  })

  return data
}, { method: 'get_nearest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCity, getNearest }

console.log('settlegrid-airvisual MCP server ready')
console.log('Methods: get_city, get_nearest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
