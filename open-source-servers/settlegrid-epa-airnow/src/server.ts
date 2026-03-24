/**
 * settlegrid-epa-airnow — EPA AirNow MCP Server
 *
 * Wraps the EPA AirNow API with SettleGrid billing.
 * Requires AIRNOW_API_KEY environment variable.
 *
 * Methods:
 *   get_current(zipCode)                     (1¢)
 *   get_forecast(zipCode)                    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCurrentInput {
  zipCode: string
  distance?: number
}

interface GetForecastInput {
  zipCode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.airnowapi.org'
const USER_AGENT = 'settlegrid-epa-airnow/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.AIRNOW_API_KEY
  if (!key) throw new Error('AIRNOW_API_KEY environment variable is required')
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
  url.searchParams.set('API_KEY', getApiKey())
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
    throw new Error(`EPA AirNow API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'epa-airnow',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: 'Get current AQI by zip code' },
      get_forecast: { costCents: 1, displayName: 'Get AQI forecast by zip code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrent = sg.wrap(async (args: GetCurrentInput) => {
  if (!args.zipCode || typeof args.zipCode !== 'string') {
    throw new Error('zipCode is required (us zip code)')
  }

  const params: Record<string, string> = {}
  params['zipCode'] = args.zipCode
  if (args.distance !== undefined) params['distance'] = String(args.distance)

  const data = await apiFetch<Record<string, unknown>>('/aq/observation/zipCode/current/', {
    params,
  })

  return data
}, { method: 'get_current' })

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (!args.zipCode || typeof args.zipCode !== 'string') {
    throw new Error('zipCode is required (us zip code)')
  }

  const params: Record<string, string> = {}
  params['zipCode'] = args.zipCode

  const data = await apiFetch<Record<string, unknown>>('/aq/forecast/zipCode/', {
    params,
  })

  return data
}, { method: 'get_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrent, getForecast }

console.log('settlegrid-epa-airnow MCP server ready')
console.log('Methods: get_current, get_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
