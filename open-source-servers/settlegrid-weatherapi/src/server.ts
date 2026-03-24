/**
 * settlegrid-weatherapi — WeatherAPI MCP Server
 *
 * Wraps the WeatherAPI API with SettleGrid billing.
 * Requires WEATHERAPI_KEY environment variable.
 *
 * Methods:
 *   get_current(query)                       (1¢)
 *   get_forecast(query)                      (2¢)
 *   get_astronomy(query)                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCurrentInput {
  query: string
}

interface GetForecastInput {
  query: string
  days?: number
}

interface GetAstronomyInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weatherapi.com/v1'
const USER_AGENT = 'settlegrid-weatherapi/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.WEATHERAPI_KEY
  if (!key) throw new Error('WEATHERAPI_KEY environment variable is required')
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
    throw new Error(`WeatherAPI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'weatherapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: 'Get current weather conditions' },
      get_forecast: { costCents: 2, displayName: 'Get weather forecast up to 3 days' },
      get_astronomy: { costCents: 1, displayName: 'Get sunrise, sunset, moonrise, and moon phase' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrent = sg.wrap(async (args: GetCurrentInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (city name, zip, ip, or lat,lon)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.query

  const data = await apiFetch<Record<string, unknown>>('/current.json', {
    params,
  })

  return data
}, { method: 'get_current' })

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (city name, zip, ip, or lat,lon)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.query
  if (args.days !== undefined) params['days'] = String(args.days)

  const data = await apiFetch<Record<string, unknown>>('/forecast.json', {
    params,
  })

  return data
}, { method: 'get_forecast' })

const getAstronomy = sg.wrap(async (args: GetAstronomyInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (city name, zip, ip, or lat,lon)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.query

  const data = await apiFetch<Record<string, unknown>>('/astronomy.json', {
    params,
  })

  return data
}, { method: 'get_astronomy' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrent, getForecast, getAstronomy }

console.log('settlegrid-weatherapi MCP server ready')
console.log('Methods: get_current, get_forecast, get_astronomy')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
