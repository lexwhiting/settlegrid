/**
 * settlegrid-uk-weather — UK Met Office Weather MCP Server
 *
 * Wraps Met Office DataHub with SettleGrid billing.
 * Free key from https://datahub.metoffice.gov.uk/.
 *
 * Methods:
 *   get_forecast(lat, lon)                 — Get weather forecast (2¢)
 *   get_observations(lat, lon)             — Get observations (2¢)
 *   get_warnings()                         — Get weather warnings (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetForecastInput {
  lat: number
  lon: number
}

interface GetObservationsInput {
  lat: number
  lon: number
}

interface GetWarningsInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.hub.api.metoffice.gov.uk'
const API_KEY = process.env.MET_OFFICE_API_KEY || ''
const USER_AGENT = 'settlegrid-uk-weather/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
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
    apikey: API_KEY,
  }
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Met Office API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-weather',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_forecast: { costCents: 2, displayName: 'Get UK weather forecast' },
      get_observations: { costCents: 2, displayName: 'Get weather observations' },
      get_warnings: { costCents: 2, displayName: 'Get weather warnings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/point/hourly', {
    params: { latitude: String(args.lat), longitude: String(args.lon) },
  })
  return data
}, { method: 'get_forecast' })

const getObservations = sg.wrap(async (args: GetObservationsInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/point/observation', {
    params: { latitude: String(args.lat), longitude: String(args.lon) },
  })
  return data
}, { method: 'get_observations' })

const getWarnings = sg.wrap(async (_args: GetWarningsInput) => {
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/warnings')
  return data
}, { method: 'get_warnings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getObservations, getWarnings }

console.log('settlegrid-uk-weather MCP server ready')
console.log('Methods: get_forecast, get_observations, get_warnings')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
