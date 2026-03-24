/**
 * settlegrid-tomorrow-io — Tomorrow.io MCP Server
 *
 * Wraps the Tomorrow.io API with SettleGrid billing.
 * Requires TOMORROW_IO_API_KEY environment variable.
 *
 * Methods:
 *   get_realtime(location)                   (1¢)
 *   get_forecast(location)                   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRealtimeInput {
  location: string
}

interface GetForecastInput {
  location: string
  timesteps?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.tomorrow.io/v4'
const USER_AGENT = 'settlegrid-tomorrow-io/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.TOMORROW_IO_API_KEY
  if (!key) throw new Error('TOMORROW_IO_API_KEY environment variable is required')
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
  url.searchParams.set('apikey', getApiKey())
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
    throw new Error(`Tomorrow.io API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tomorrow-io',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_realtime: { costCents: 1, displayName: 'Get real-time weather conditions' },
      get_forecast: { costCents: 2, displayName: 'Get hourly or daily forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRealtime = sg.wrap(async (args: GetRealtimeInput) => {
  if (!args.location || typeof args.location !== 'string') {
    throw new Error('location is required (lat,lon or city name)')
  }

  const params: Record<string, string> = {}
  params['location'] = args.location

  const data = await apiFetch<Record<string, unknown>>('/weather/realtime', {
    params,
  })

  return data
}, { method: 'get_realtime' })

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (!args.location || typeof args.location !== 'string') {
    throw new Error('location is required (lat,lon or city name)')
  }

  const params: Record<string, string> = {}
  params['location'] = args.location
  if (args.timesteps !== undefined) params['timesteps'] = String(args.timesteps)

  const data = await apiFetch<Record<string, unknown>>('/weather/forecast', {
    params,
  })

  return data
}, { method: 'get_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRealtime, getForecast }

console.log('settlegrid-tomorrow-io MCP server ready')
console.log('Methods: get_realtime, get_forecast')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
