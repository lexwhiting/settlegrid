/**
 * settlegrid-openmeteo-marine — Open-Meteo Marine MCP Server
 *
 * Wraps the Open-Meteo Marine API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_marine(latitude, longitude)          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetMarineInput {
  latitude: number
  longitude: number
  hourly?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://marine-api.open-meteo.com/v1'
const USER_AGENT = 'settlegrid-openmeteo-marine/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Open-Meteo Marine API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openmeteo-marine',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_marine: { costCents: 1, displayName: 'Get marine weather forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMarine = sg.wrap(async (args: GetMarineInput) => {
  if (typeof args.latitude !== 'number' || isNaN(args.latitude)) {
    throw new Error('latitude must be a number')
  }
  if (typeof args.longitude !== 'number' || isNaN(args.longitude)) {
    throw new Error('longitude must be a number')
  }

  const params: Record<string, string> = {}
  params['latitude'] = String(args.latitude)
  params['longitude'] = String(args.longitude)
  if (args.hourly !== undefined) params['hourly'] = String(args.hourly)

  const data = await apiFetch<Record<string, unknown>>('/marine', {
    params,
  })

  return data
}, { method: 'get_marine' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMarine }

console.log('settlegrid-openmeteo-marine MCP server ready')
console.log('Methods: get_marine')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
