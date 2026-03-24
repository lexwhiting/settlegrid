/**
 * settlegrid-open-meteo — Open-Meteo MCP Server
 *
 * Wraps the Open-Meteo API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_forecast(latitude, longitude)        (1¢)
 *   get_historical(latitude, longitude, start_date, end_date) (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetForecastInput {
  latitude: number
  longitude: number
  daily?: string
}

interface GetHistoricalInput {
  latitude: number
  longitude: number
  start_date: string
  end_date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open-meteo.com/v1'
const USER_AGENT = 'settlegrid-open-meteo/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Open-Meteo API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-meteo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_forecast: { costCents: 1, displayName: 'Get weather forecast by coordinates' },
      get_historical: { costCents: 2, displayName: 'Get historical weather data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (typeof args.latitude !== 'number' || isNaN(args.latitude)) {
    throw new Error('latitude must be a number')
  }
  if (typeof args.longitude !== 'number' || isNaN(args.longitude)) {
    throw new Error('longitude must be a number')
  }

  const params: Record<string, string> = {}
  params['latitude'] = String(args.latitude)
  params['longitude'] = String(args.longitude)
  if (args.daily !== undefined) params['daily'] = String(args.daily)

  const data = await apiFetch<Record<string, unknown>>('/forecast', {
    params,
  })

  return data
}, { method: 'get_forecast' })

const getHistorical = sg.wrap(async (args: GetHistoricalInput) => {
  if (typeof args.latitude !== 'number' || isNaN(args.latitude)) {
    throw new Error('latitude must be a number')
  }
  if (typeof args.longitude !== 'number' || isNaN(args.longitude)) {
    throw new Error('longitude must be a number')
  }
  if (!args.start_date || typeof args.start_date !== 'string') {
    throw new Error('start_date is required (start date yyyy-mm-dd)')
  }
  if (!args.end_date || typeof args.end_date !== 'string') {
    throw new Error('end_date is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['latitude'] = String(args.latitude)
  params['longitude'] = String(args.longitude)
  params['start_date'] = args.start_date
  params['end_date'] = args.end_date

  const data = await apiFetch<Record<string, unknown>>('/archive', {
    params,
  })

  return data
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getHistorical }

console.log('settlegrid-open-meteo MCP server ready')
console.log('Methods: get_forecast, get_historical')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
