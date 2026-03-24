/**
 * settlegrid-openweathermap — OpenWeatherMap MCP Server
 *
 * Wraps the OpenWeatherMap API with SettleGrid billing.
 * Requires OPENWEATHERMAP_API_KEY environment variable.
 *
 * Methods:
 *   get_weather(city)                        (1¢)
 *   get_forecast(city)                       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetWeatherInput {
  city: string
  units?: string
}

interface GetForecastInput {
  city: string
  units?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.openweathermap.org/data/2.5'
const USER_AGENT = 'settlegrid-openweathermap/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.OPENWEATHERMAP_API_KEY
  if (!key) throw new Error('OPENWEATHERMAP_API_KEY environment variable is required')
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
  url.searchParams.set('appid', getApiKey())
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
    throw new Error(`OpenWeatherMap API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openweathermap',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_weather: { costCents: 1, displayName: 'Get current weather for a city' },
      get_forecast: { costCents: 2, displayName: 'Get 5-day/3-hour weather forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getWeather = sg.wrap(async (args: GetWeatherInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (city name)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.city
  if (args.units !== undefined) params['units'] = String(args.units)

  const data = await apiFetch<Record<string, unknown>>('/weather', {
    params,
  })

  return data
}, { method: 'get_weather' })

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (city name)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.city
  if (args.units !== undefined) params['units'] = String(args.units)

  const data = await apiFetch<Record<string, unknown>>('/forecast', {
    params,
  })

  return data
}, { method: 'get_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getWeather, getForecast }

console.log('settlegrid-openweathermap MCP server ready')
console.log('Methods: get_weather, get_forecast')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
