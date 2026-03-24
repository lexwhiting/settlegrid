/**
 * settlegrid-windy — Windy MCP Server
 *
 * Wraps the Windy API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_point_forecast(lat, lon, key)        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPointForecastInput {
  lat: number
  lon: number
  model?: string
  key: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.windy.com/api/point-forecast/v2'
const USER_AGENT = 'settlegrid-windy/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Windy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'windy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_point_forecast: { costCents: 2, displayName: 'Get point forecast from GFS/ECMWF models' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPointForecast = sg.wrap(async (args: GetPointForecastInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lon !== 'number' || isNaN(args.lon)) {
    throw new Error('lon must be a number')
  }
  if (!args.key || typeof args.key !== 'string') {
    throw new Error('key is required (windy api key)')
  }

  const body: Record<string, unknown> = {}
  body['lat'] = args.lat
  body['lon'] = args.lon
  if (args.model !== undefined) body['model'] = args.model
  body['key'] = args.key

  const data = await apiFetch<Record<string, unknown>>('', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'get_point_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPointForecast }

console.log('settlegrid-windy MCP server ready')
console.log('Methods: get_point_forecast')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
