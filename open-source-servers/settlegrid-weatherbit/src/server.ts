/**
 * settlegrid-weatherbit — Weatherbit MCP Server
 *
 * Wraps the Weatherbit API with SettleGrid billing.
 * Requires WEATHERBIT_API_KEY environment variable.
 *
 * Methods:
 *   get_current(city)                        (1¢)
 *   get_forecast_daily(city)                 (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCurrentInput {
  city: string
}

interface GetForecastDailyInput {
  city: string
  days?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weatherbit.io/v2.0'
const USER_AGENT = 'settlegrid-weatherbit/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.WEATHERBIT_API_KEY
  if (!key) throw new Error('WEATHERBIT_API_KEY environment variable is required')
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
    throw new Error(`Weatherbit API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'weatherbit',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: 'Get current weather data' },
      get_forecast_daily: { costCents: 2, displayName: 'Get 16-day daily forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrent = sg.wrap(async (args: GetCurrentInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (city name)')
  }

  const params: Record<string, string> = {}
  params['city'] = args.city

  const data = await apiFetch<Record<string, unknown>>('/current', {
    params,
  })

  return data
}, { method: 'get_current' })

const getForecastDaily = sg.wrap(async (args: GetForecastDailyInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (city name)')
  }

  const params: Record<string, string> = {}
  params['city'] = args.city
  if (args.days !== undefined) params['days'] = String(args.days)

  const data = await apiFetch<Record<string, unknown>>('/forecast/daily', {
    params,
  })

  return data
}, { method: 'get_forecast_daily' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrent, getForecastDaily }

console.log('settlegrid-weatherbit MCP server ready')
console.log('Methods: get_current, get_forecast_daily')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
