/**
 * settlegrid-stormglass — Storm Glass MCP Server
 *
 * Wraps the Storm Glass API with SettleGrid billing.
 * Requires STORMGLASS_API_KEY environment variable.
 *
 * Methods:
 *   get_weather(lat, lng)                    (2¢)
 *   get_tide(lat, lng)                       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetWeatherInput {
  lat: number
  lng: number
  params?: string
}

interface GetTideInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.stormglass.io/v2'
const USER_AGENT = 'settlegrid-stormglass/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.STORMGLASS_API_KEY
  if (!key) throw new Error('STORMGLASS_API_KEY environment variable is required')
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Authorization': `${getApiKey()}`,
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
    throw new Error(`Storm Glass API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'stormglass',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_weather: { costCents: 2, displayName: 'Get point-based marine weather data' },
      get_tide: { costCents: 2, displayName: 'Get tide extremes (highs and lows)' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getWeather = sg.wrap(async (args: GetWeatherInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)
  if (args.params !== undefined) params['params'] = String(args.params)

  const data = await apiFetch<Record<string, unknown>>('/weather/point', {
    params,
  })

  return data
}, { method: 'get_weather' })

const getTide = sg.wrap(async (args: GetTideInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)

  const data = await apiFetch<Record<string, unknown>>('/tide/extremes/point', {
    params,
  })

  return data
}, { method: 'get_tide' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getWeather, getTide }

console.log('settlegrid-stormglass MCP server ready')
console.log('Methods: get_weather, get_tide')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
